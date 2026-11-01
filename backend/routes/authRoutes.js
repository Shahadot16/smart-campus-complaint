const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators/authValidators');
const ctrl = require('../controllers/authController');

const router = express.Router();

// Brute-force protection: failed logins per IP are limited.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: () => config.isTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  skip: () => config.isTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many accounts created from this network. Please try later.' },
});

// Limits requests that send emails, so the endpoints can't be used to spam inboxes.
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: () => config.isTest,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many email requests. Please try again later.' },
});

router.post('/register', registerLimiter, validate(v.register), ctrl.register);
router.post('/login', loginLimiter, validate(v.login), ctrl.login);
router.post('/2fa/login', loginLimiter, validate(v.twoFactorLogin), ctrl.loginTwoFactor);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', auth, ctrl.me);
router.patch('/me', auth, validate(v.updateProfile), ctrl.updateProfile);
router.patch('/password', auth, validate(v.changePassword), ctrl.changePassword);

router.post('/verify-email', validate(v.verifyEmail), ctrl.verifyEmail);
router.post('/resend-verification', auth, emailLimiter, ctrl.resendVerification);
router.post('/forgot-password', emailLimiter, validate(v.forgotPassword), ctrl.forgotPassword);
router.post('/reset-password', validate(v.resetPassword), ctrl.resetPassword);

router.post('/2fa/setup', auth, ctrl.setupTwoFactor);
router.post('/2fa/enable', auth, validate(v.twoFactorEnable), ctrl.enableTwoFactor);
router.post('/2fa/disable', auth, validate(v.twoFactorDisable), ctrl.disableTwoFactor);

router.get('/sessions', auth, ctrl.listSessions);
router.post('/sessions/revoke-others', auth, ctrl.revokeOtherSessions);
router.delete('/sessions/:id', auth, ctrl.revokeSession);

module.exports = router;
