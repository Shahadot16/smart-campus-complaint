const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction || config.cookieSameSite === 'none',
    sameSite: config.cookieSameSite,
    path: '/',
  };
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  res.cookie(config.cookieName, token, { ...cookieOptions(), maxAge: COOKIE_MAX_AGE });
}

/** Safe public profile — never includes the password hash. */
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
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

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

  issueSession(res, user);
  sendSuccess(res, { status: 201, message: 'Registration successful', data: { user: profile(user) } });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  // Same message for unknown email and wrong password, so accounts can't be probed.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Please contact the administrator.');

  user.lastLoginAt = new Date();
  await user.save();

  issueSession(res, user);
  sendSuccess(res, { message: 'Login successful', data: { user: profile(user) } });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  sendSuccess(res, { data: { user: profile(req.user) } });
};

// POST /api/auth/logout
exports.logout = async (_req, res) => {
  res.clearCookie(config.cookieName, cookieOptions());
  sendSuccess(res, { message: 'Logged out' });
};

// PATCH /api/auth/me — users may change only their own non-privileged fields.
exports.updateProfile = async (req, res) => {
  for (const field of ['name', 'department', 'phone']) {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  }
  await req.user.save();
  sendSuccess(res, { message: 'Profile updated', data: { user: profile(req.user) } });
};

// PATCH /api/auth/password
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
  issueSession(res, user);
  sendSuccess(res, { message: 'Password changed successfully' });
};

exports.profile = profile;
