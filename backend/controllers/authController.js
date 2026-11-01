const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { generateSecret, generateURI, verifySync } = require('otplib');
const config = require('../config/env');
const university = require('../config/university');
const { User, Session, AuthToken } = require('../models');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');
const { randomToken, hashToken } = require('../utils/tokens');
const { sendMail, button, isRealMail } = require('../utils/mailer');
const { ROLE_PERMISSIONS } = require('../utils/permissions');

const DAY = 24 * 60 * 60 * 1000;
const EMAIL_PREFS = ['statusUpdates', 'assignments', 'slaAlerts', 'chatMessages', 'dailyDigest'];
// In development without SMTP, emailed links are also returned so the flow can be tested.
const exposeDevLinks = !config.isProduction && !isRealMail;

/* ------------------------------ Cookies ------------------------------ */

function cookieOptions(path = '/') {
  return {
    httpOnly: true,
    secure: config.isProduction || config.cookieSameSite === 'none',
    sameSite: config.cookieSameSite,
    path,
  };
}

const REFRESH_PATH = '/api/auth';

function clearAuthCookies(res) {
  res.clearCookie(config.cookieName, cookieOptions());
  res.clearCookie(config.refreshCookieName, cookieOptions(REFRESH_PATH));
}

function setAccessCookie(res, user, sessionId) {
  const token = jwt.sign({ sub: String(user._id), role: user.role, sid: String(sessionId) }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl,
  });
  const { exp } = jwt.decode(token);
  res.cookie(config.cookieName, token, { ...cookieOptions(), maxAge: exp * 1000 - Date.now() });
}

function setRefreshCookie(res, token) {
  res.cookie(config.refreshCookieName, token, {
    ...cookieOptions(REFRESH_PATH),
    maxAge: config.refreshTokenDays * DAY,
  });
}

/** Creates a session (one per device) and sets both auth cookies. */
async function startSession(req, res, user) {
  const token = randomToken();
  const session = await Session.create({
    user: user._id,
    tokenHash: hashToken(token),
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
    ip: req.ip || '',
    expiresAt: new Date(Date.now() + config.refreshTokenDays * DAY),
  });
  setAccessCookie(res, user, session._id);
  setRefreshCookie(res, token);
  return session;
}

/** Safe public profile — never includes the password hash or 2FA secret. */
function profile(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId || null,
    department: user.department,
    phone: user.phone,
    isActive: user.isActive,
    emailVerified: Boolean(user.emailVerified),
    twoFactorEnabled: Boolean(user.twoFactor?.enabled),
    emailPrefs: user.emailPrefs?.toObject ? user.emailPrefs.toObject() : user.emailPrefs || {},
    permissions: ROLE_PERMISSIONS[user.role] || [],
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

/* --------------------------- Email tokens --------------------------- */

async function createAuthToken(user, type, ttlMs) {
  // Only the newest link of each type stays valid.
  await AuthToken.deleteMany({ user: user._id, type, usedAt: null });
  const token = randomToken();
  await AuthToken.create({ user: user._id, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function consumeAuthToken(token, type) {
  const doc = await AuthToken.findOneAndUpdate(
    { tokenHash: hashToken(token), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!doc) throw ApiError.badRequest('This link is invalid or has expired. Please request a new one.');
  return doc;
}

async function sendVerificationEmail(user) {
  const token = await createAuthToken(user, 'verify_email', 2 * DAY);
  const url = `${config.appUrl}/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: `Verify your ${university.shortName} Smart Campus email`,
    title: `Welcome, ${user.name.split(' ')[0]}!`,
    html: `<p>Please confirm your email address to finish setting up your account.</p>${button(url, 'Verify email')}<p>This link expires in 48 hours.</p>`,
    text: `Verify your email: ${url}`,
  });
  return url;
}

/* ------------------------------ Handlers ----------------------------- */

// POST /api/auth/register — public registration always creates a student.
exports.register = async (req, res) => {
  const { name, email, password, studentId, department, phone } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { studentId }] }).lean();
  if (existing) {
    throw ApiError.conflict(existing.email === email ? 'Email already exists' : 'Student ID already exists');
  }

  const user = new User({ name, email, studentId, department, phone, role: 'student' });
  await user.setPassword(password);
  await user.save();

  const verifyUrl = await sendVerificationEmail(user);
  await startSession(req, res, user);
  const data = { user: profile(user) };
  if (exposeDevLinks) data.devLink = verifyUrl;
  sendSuccess(res, { status: 201, message: 'Registration successful. Please check your email to verify it.', data });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  if (user?.lockUntil && user.lockUntil > new Date()) {
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(423, `Too many failed attempts. This account is locked for ${minutes} more minute(s).`);
  }

  // Same message for unknown email and wrong password, so accounts can't be probed.
  if (!user || !(await user.comparePassword(password))) {
    if (user) {
      user.failedLogins += 1;
      if (user.failedLogins >= config.maxFailedLogins) {
        user.lockUntil = new Date(Date.now() + config.lockMinutes * 60000);
        user.failedLogins = 0;
      }
      await user.save();
    }
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Please contact the administrator.');

  user.failedLogins = 0;
  user.lockUntil = undefined;

  // Second step for accounts with two-factor authentication.
  if (user.twoFactor?.enabled) {
    await user.save();
    const challengeToken = jwt.sign({ sub: String(user._id), purpose: '2fa' }, config.jwtSecret, { expiresIn: '5m' });
    return sendSuccess(res, { message: 'Enter the 6-digit code from your authenticator app', data: { twoFactorRequired: true, challengeToken } });
  }

  user.lastLoginAt = new Date();
  await user.save();
  await startSession(req, res, user);
  sendSuccess(res, { message: 'Login successful', data: { user: profile(user) } });
};

// POST /api/auth/2fa/login — second login step
exports.loginTwoFactor = async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.body.challengeToken, config.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Your sign-in attempt expired. Please sign in again.');
  }
  if (payload.purpose !== '2fa') throw ApiError.unauthorized('Invalid sign-in attempt');

  const user = await User.findById(payload.sub).select('+twoFactor.secret');
  if (!user || !user.isActive || !user.twoFactor?.enabled) throw ApiError.unauthorized('Invalid sign-in attempt');
  if (!verifyTotp(req.body.code, user.twoFactor.secret)) throw ApiError.unauthorized('Incorrect verification code');

  user.lastLoginAt = new Date();
  await user.save();
  await startSession(req, res, user);
  sendSuccess(res, { message: 'Login successful', data: { user: profile(user) } });
};

// POST /api/auth/refresh — rotates the refresh token and issues a new access token
exports.refresh = async (req, res) => {
  const token = req.cookies?.[config.refreshCookieName];
  if (!token) throw ApiError.unauthorized('Session expired. Please log in again.');
  const hash = hashToken(token);

  const session = await Session.findOne({ tokenHash: hash });
  if (!session) {
    // An old token being replayed means it was copied: end every session of that user.
    const stolen = await Session.findOne({ previousHashes: hash });
    if (stolen) await Session.updateMany({ user: stolen.user, revokedAt: null }, { revokedAt: new Date() });
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }
  if (session.revokedAt || session.expiresAt <= new Date()) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }

  const user = await User.findById(session.user);
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Account not found or deactivated');
  }

  const next = randomToken();
  await Session.updateOne(
    { _id: session._id, tokenHash: hash },
    { tokenHash: hashToken(next), lastUsedAt: new Date(), $push: { previousHashes: { $each: [hash], $slice: -20 } } }
  );
  setAccessCookie(res, user, session._id);
  setRefreshCookie(res, next);
  sendSuccess(res, { message: 'Session refreshed', data: { user: profile(user) } });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  sendSuccess(res, { data: { user: profile(req.user) } });
};

// POST /api/auth/logout — ends this device's session
exports.logout = async (req, res) => {
  const token = req.cookies?.[config.refreshCookieName];
  if (token) await Session.updateOne({ tokenHash: hashToken(token) }, { revokedAt: new Date() });
  clearAuthCookies(res);
  sendSuccess(res, { message: 'Logged out' });
};

// PATCH /api/auth/me — users may change only their own non-privileged fields.
exports.updateProfile = async (req, res) => {
  for (const field of ['name', 'department', 'phone']) {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  }
  for (const [key, value] of Object.entries(req.body.emailPrefs || {})) {
    if (EMAIL_PREFS.includes(key)) req.user.set(`emailPrefs.${key}`, Boolean(value));
  }
  await req.user.save();
  sendSuccess(res, { message: 'Profile updated', data: { user: profile(req.user) } });
};

// PATCH /api/auth/password — signs out every other device
exports.changePassword = async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  if (req.body.currentPassword === req.body.newPassword) {
    throw ApiError.badRequest('New password must be different from the current password');
  }
  await user.setPassword(req.body.newPassword);
  await user.save();
  await Session.updateMany({ user: user._id, _id: { $ne: req.sessionId }, revokedAt: null }, { revokedAt: new Date() });
  sendSuccess(res, { message: 'Password changed. Other devices have been signed out.' });
};

/* ------------------------- Email verification ------------------------ */

// POST /api/auth/verify-email
exports.verifyEmail = async (req, res) => {
  const doc = await consumeAuthToken(req.body.token, 'verify_email');
  await User.updateOne({ _id: doc.user }, { emailVerified: true });
  sendSuccess(res, { message: 'Email verified. Thank you!' });
};

// POST /api/auth/resend-verification
exports.resendVerification = async (req, res) => {
  if (req.user.emailVerified) throw ApiError.badRequest('Your email is already verified');
  const url = await sendVerificationEmail(req.user);
  sendSuccess(res, { message: `Verification email sent to ${req.user.email}`, data: exposeDevLinks ? { devLink: url } : undefined });
};

/* --------------------------- Password reset -------------------------- */

const RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

// POST /api/auth/forgot-password — same answer whether or not the email exists
exports.forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  let devLink;
  if (user) {
    const token = await createAuthToken(user, 'reset_password', 60 * 60 * 1000);
    const url = `${config.appUrl}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your password',
      title: 'Password reset request',
      html: `<p>We received a request to reset your password.</p>${button(url, 'Choose a new password')}<p>This link expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`,
      text: `Reset your password: ${url}`,
    });
    if (exposeDevLinks) devLink = url;
  }
  sendSuccess(res, { message: RESET_MESSAGE, data: devLink ? { devLink } : undefined });
};

// POST /api/auth/reset-password — also signs out every device
exports.resetPassword = async (req, res) => {
  const doc = await consumeAuthToken(req.body.token, 'reset_password');
  const user = await User.findById(doc.user);
  if (!user || !user.isActive) throw ApiError.badRequest('This account is not active');
  await user.setPassword(req.body.password);
  user.failedLogins = 0;
  user.lockUntil = undefined;
  await user.save();
  await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  sendSuccess(res, { message: 'Password updated. You can now sign in with your new password.' });
};

/* ---------------------- Two-factor authentication -------------------- */

function verifyTotp(code, secret) {
  if (!secret || !/^\d{6}$/.test(String(code || ''))) return false;
  // Accept one 30-second step of clock drift either way.
  return verifySync({ token: String(code), secret, epochTolerance: 30 }).valid;
}

// POST /api/auth/2fa/setup — creates a pending secret and returns its QR code
exports.setupTwoFactor = async (req, res) => {
  if (req.user.twoFactor?.enabled) throw ApiError.badRequest('Two-factor authentication is already on');
  const secret = generateSecret();
  await User.updateOne({ _id: req.user._id }, { 'twoFactor.pendingSecret': secret });
  const otpauthUrl = generateURI({ issuer: `${university.shortName} Smart Campus`, label: req.user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
  sendSuccess(res, { data: { secret, otpauthUrl, qrDataUrl } });
};

// POST /api/auth/2fa/enable — confirms the pending secret with a code
exports.enableTwoFactor = async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactor.pendingSecret');
  if (!user.twoFactor?.pendingSecret) throw ApiError.badRequest('Start the setup first');
  if (!verifyTotp(req.body.code, user.twoFactor.pendingSecret)) throw ApiError.badRequest('Incorrect code. Check your authenticator app and try again.');
  user.twoFactor = { enabled: true, secret: user.twoFactor.pendingSecret, pendingSecret: undefined };
  await user.save();
  sendSuccess(res, { message: 'Two-factor authentication is now on', data: { user: profile(user) } });
};

// POST /api/auth/2fa/disable — needs the password and a current code
exports.disableTwoFactor = async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash +twoFactor.secret');
  if (!user.twoFactor?.enabled) throw ApiError.badRequest('Two-factor authentication is not on');
  if (!(await user.comparePassword(req.body.password))) throw ApiError.badRequest('Password is incorrect');
  if (!verifyTotp(req.body.code, user.twoFactor.secret)) throw ApiError.badRequest('Incorrect verification code');
  user.twoFactor = { enabled: false };
  await user.save();
  sendSuccess(res, { message: 'Two-factor authentication turned off', data: { user: profile(user) } });
};

/* ------------------------------ Sessions ----------------------------- */

// GET /api/auth/sessions — my signed-in devices
exports.listSessions = async (req, res) => {
  const sessions = await Session.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .select('userAgent ip createdAt lastUsedAt')
    .lean();
  sendSuccess(res, {
    data: sessions.map((s) => ({ ...s, current: String(s._id) === String(req.sessionId) })),
  });
};

// DELETE /api/auth/sessions/:id
exports.revokeSession = async (req, res) => {
  const result = await Session.updateOne({ _id: req.params.id, user: req.user._id, revokedAt: null }, { revokedAt: new Date() });
  if (!result.matchedCount) throw ApiError.notFound('Session not found');
  sendSuccess(res, { message: 'Device signed out' });
};

// POST /api/auth/sessions/revoke-others
exports.revokeOtherSessions = async (req, res) => {
  const result = await Session.updateMany(
    { user: req.user._id, _id: { $ne: req.sessionId }, revokedAt: null },
    { revokedAt: new Date() }
  );
  sendSuccess(res, { message: `${result.modifiedCount} other device(s) signed out` });
};

exports.profile = profile;
