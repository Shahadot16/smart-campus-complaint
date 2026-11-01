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

router.post('/register', registerLimiter, validate(v.register), ctrl.register);
router.post('/login', loginLimiter, validate(v.login), ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', auth, ctrl.me);
router.patch('/me', auth, validate(v.updateProfile), ctrl.updateProfile);
router.patch('/password', auth, validate(v.changePassword), ctrl.changePassword);

module.exports = router;
