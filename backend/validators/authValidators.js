const { body } = require('express-validator');

// Rule factories: express-validator chains are mutable, so every route gets fresh ones.
const name = () =>
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters');

const email = () =>
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .isLength({ max: 120 })
    .normalizeEmail({ gmail_remove_dots: false });

const strongPassword = (field = 'password') =>
  body(field)
    .isString()
    .withMessage('Password is required')
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be 8–72 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain a letter')
    .matches(/\d/)
    .withMessage('Password must contain a number');

const studentId = () =>
  body('studentId')
    .trim()
    .notEmpty()
    .withMessage('Student ID is required')
    .matches(/^[A-Za-z0-9-]{3,30}$/)
    .withMessage('Student ID may contain letters, numbers and dashes (3–30 characters)');

const department = () =>
  body('department').optional().trim().isLength({ max: 80 }).withMessage('Department is too long');

const phone = () =>
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[+\d\s-]{6,20}$/)
    .withMessage('Please enter a valid phone number');

exports.register = [name(), email(), strongPassword(), studentId(), department(), phone()];

exports.login = [
  email(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

exports.updateProfile = [name().optional(), department(), phone()];

exports.changePassword = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  strongPassword('newPassword'),
];

const code = () => body('code').trim().matches(/^\d{6}$/).withMessage('Enter the 6-digit code');
const token = () => body('token').isString().isLength({ min: 20, max: 200 }).withMessage('Invalid or missing link token');

exports.verifyEmail = [token()];
exports.forgotPassword = [email()];
exports.resetPassword = [token(), strongPassword()];
exports.twoFactorLogin = [body('challengeToken').isString().notEmpty().withMessage('Sign-in attempt missing'), code()];
exports.twoFactorEnable = [code()];
exports.twoFactorDisable = [body('password').isString().notEmpty().withMessage('Password is required'), code()];

exports.rules = { name, email, strongPassword, department, phone };
