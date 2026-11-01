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

const { PRIORITIES } = require('../utils/constants');

exports.slaPolicy = [
  body('priority').isIn(PRIORITIES).withMessage('Invalid priority'),
  body('category').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category'),
  body('responseHours').isFloat({ min: 0.25, max: 720 }).withMessage('Response time must be 0.25–720 hours').toFloat(),
  body('resolveHours').isFloat({ min: 0.5, max: 2160 }).withMessage('Resolution time must be 0.5–2160 hours').toFloat(),
];

const locationCode = () =>
  body('code').trim().matches(/^[A-Za-z0-9-]{2,24}$/).withMessage('Code may contain letters, numbers and dashes (2–24 characters)');
const coords = [
  body('lat').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude').toFloat(),
  body('lng').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude').toFloat(),
];

exports.createLocation = [
  body('name').trim().isLength({ min: 1, max: 80 }).withMessage('Name is required (max 80 characters)'),
  body('type').isIn(['building', 'floor', 'room']).withMessage('Type must be building, floor or room'),
  body('parent').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid parent'),
  locationCode(),
  body('department').optional().trim().isLength({ max: 10 }),
  ...coords,
];

exports.updateLocation = [
  body('name').optional().trim().isLength({ min: 1, max: 80 }).withMessage('Name is required (max 80 characters)'),
  locationCode().optional(),
  body('department').optional().trim().isLength({ max: 10 }),
  body('isActive').optional().isBoolean().toBoolean(),
  ...coords,
];

exports.reports = [
  query('from').optional().isISO8601().withMessage('Invalid start date'),
  query('to').optional().isISO8601().withMessage('Invalid end date'),
];
