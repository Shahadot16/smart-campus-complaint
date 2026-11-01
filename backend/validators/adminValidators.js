const { body, query } = require('express-validator');
const { rules } = require('./authValidators');

exports.createUser = [
  rules.name(),
  rules.email(),
  rules.strongPassword(),
  body('role').isIn(['staff', 'admin', 'dept_head']).withMessage('Role must be staff, admin or dept_head'),
  body('department').if(body('role').equals('dept_head')).trim().notEmpty().withMessage('A department head needs a department'),
  rules.department(),
  rules.phone(),
];

exports.updateUser = [
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  body('role').optional().isIn(['student', 'staff', 'admin', 'dept_head']).withMessage('Invalid role'),
  rules.name().optional(),
  rules.department(),
  rules.phone(),
];

exports.listUsers = [
  query('role').optional().isIn(['student', 'staff', 'admin', 'dept_head']).withMessage('Invalid role filter'),
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
  body('autoAssign').optional().isBoolean().withMessage('autoAssign must be true or false').toBoolean(),
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

exports.staffProfile = [
  body('skills').optional().isArray().withMessage('Skills must be a list'),
  body('skills.*').isMongoId().withMessage('Invalid category'),
  body('zones').optional().isArray().withMessage('Zones must be a list'),
  body('zones.*').isMongoId().withMessage('Invalid building'),
  body('maxOpenTasks').optional().isInt({ min: 1, max: 50 }).withMessage('Task limit must be 1–50').toInt(),
  body('leaves').optional().isArray(),
  body('leaves.*.from').optional().isISO8601().withMessage('Invalid leave start date'),
  body('leaves.*.to').optional().isISO8601().withMessage('Invalid leave end date'),
];

exports.asset = (isNew) => [
  isNew ? body('code').trim().matches(/^[A-Za-z0-9-]{2,24}$/).withMessage('Code may contain letters, numbers and dashes (2–24)') : body('code').not().exists().withMessage('The asset code cannot be changed'),
  (isNew ? body('name') : body('name').optional()).trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  (isNew ? body('type') : body('type').optional()).trim().isLength({ min: 2, max: 40 }).withMessage('Type must be 2–40 characters'),
  body('category').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid category'),
  body('location').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid location'),
  body('purchaseDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid purchase date'),
  body('warrantyUntil').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid warranty date'),
  body('status').optional().isIn(['operational', 'under_repair', 'retired']).withMessage('Invalid status'),
  body('serialNo').optional().trim().isLength({ max: 60 }),
  body('notes').optional().trim().isLength({ max: 500 }),
];

exports.part = (isNew) => [
  isNew ? body('sku').trim().matches(/^[A-Za-z0-9-]{2,24}$/).withMessage('SKU may contain letters, numbers and dashes (2–24)') : body('sku').not().exists().withMessage('The SKU cannot be changed'),
  (isNew ? body('name') : body('name').optional()).trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('unit').optional().trim().isLength({ min: 1, max: 12 }),
  body('minQuantity').optional().isInt({ min: 0, max: 100000 }).withMessage('Minimum must be 0 or more').toInt(),
  body('unitCost').optional().isFloat({ min: 0, max: 10000000 }).withMessage('Unit cost must be 0 or more').toFloat(),
  body('supplier').optional().trim().isLength({ max: 100 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

exports.stock = [
  body('type').isIn(['in', 'adjust']).withMessage('Type must be in or adjust'),
  body('quantity').isInt({ min: -100000, max: 100000 }).withMessage('Quantity must be a whole number').toInt().custom((v) => v !== 0).withMessage('Quantity cannot be 0'),
  body('unitCost').optional().isFloat({ min: 0 }).toFloat(),
  body('note').optional().trim().isLength({ max: 300 }),
];

exports.limits = [
  body('deptHead').isFloat({ min: 0, max: 100000000 }).withMessage('Invalid department head limit').toFloat(),
  body('admin').isFloat({ min: 0, max: 100000000 }).withMessage('Invalid admin limit').toFloat(),
];

exports.reports = [
  query('from').optional().isISO8601().withMessage('Invalid start date'),
  query('to').optional().isISO8601().withMessage('Invalid end date'),
];
