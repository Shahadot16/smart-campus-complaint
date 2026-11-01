const { body, query } = require('express-validator');
const { rules } = require('./authValidators');

exports.createUser = [
  rules.name(),
  rules.email(),
  rules.strongPassword(),
  body('role').isIn(['staff', 'admin']).withMessage('Role must be staff or admin'),
  rules.department(),
  rules.phone(),
];

exports.updateUser = [
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  body('role').optional().isIn(['student', 'staff', 'admin']).withMessage('Invalid role'),
  rules.name().optional(),
  rules.department(),
  rules.phone(),
];

exports.listUsers = [
  query('role').optional().isIn(['student', 'staff', 'admin']).withMessage('Invalid role filter'),
  query('active').optional().isIn(['true', 'false']),
  query('search').optional().isString().isLength({ max: 100 }),
];

exports.createCategory = [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Category name must be 2–60 characters'),
  body('description').optional().trim().isLength({ max: 300 }).withMessage('Description is too long'),
];

exports.updateCategory = [
  body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Category name must be 2–60 characters'),
  body('description').optional().trim().isLength({ max: 300 }).withMessage('Description is too long'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
];

exports.reports = [
  query('from').optional().isISO8601().withMessage('Invalid start date'),
  query('to').optional().isISO8601().withMessage('Invalid end date'),
];
