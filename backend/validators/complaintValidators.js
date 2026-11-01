const { body, query } = require('express-validator');
const { PRIORITIES, STATUSES } = require('../utils/constants');

// Rule factories: express-validator chains are mutable, so every route gets fresh ones.
const title = () => body('title').trim().isLength({ min: 5, max: 120 }).withMessage('Title must be 5–120 characters');
const description = () =>
  body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10–2000 characters');
const category = () => body('category').isMongoId().withMessage('Please choose a valid category');
// Either a location id from the campus tree, or a typed building name.
const building = () =>
  body('building')
    .if(body('place').not().exists({ values: 'falsy' }))
    .if(body('asset').not().exists({ values: 'falsy' }))
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Building is required (max 80 characters)');
const place = () => body('place').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid location');
const room = () => body('room').optional().trim().isLength({ max: 40 }).withMessage('Room is too long');
const priority = () =>
  body('priority').optional().isIn(PRIORITIES).withMessage(`Priority must be one of: ${PRIORITIES.join(', ')}`);
const note = (field = 'note', max = 2000) =>
  body(field).optional().isString().trim().isLength({ max }).withMessage(`Note must be at most ${max} characters`);

const asset = () => body('asset').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid asset');

const visibility = () => body('visibility').optional().isIn(['public', 'private']).withMessage('Visibility must be public or private');
const anonymous = () => body('isAnonymous').optional().isBoolean().withMessage('isAnonymous must be true or false').toBoolean();

exports.create = [title(), description(), category(), building(), room(), place(), asset(), priority(), visibility(), anonymous()];

exports.aiDraft = [
  body('title').optional().isString().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 4000 }),
  body('category').optional({ values: 'falsy' }).isMongoId(),
  body('building').optional().isString().isLength({ max: 80 }),
  body('room').optional().isString().isLength({ max: 40 }),
];

exports.aiChat = [body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Please type a message (max 1000 characters)')];

exports.useParts = [
  body('part').isMongoId().withMessage('Please choose a part'),
  body('quantity').isInt({ min: 1, max: 1000 }).withMessage('Quantity must be 1–1000').toInt(),
];

exports.workOrder = [
  body('description').isString().trim().isLength({ min: 5, max: 1000 }).withMessage('Describe the work (5–1000 characters)'),
  body('estimatedCost').isFloat({ min: 0, max: 100000000 }).withMessage('Enter the estimated cost in BDT').toFloat(),
];

exports.decision = [
  body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
];

// Owners may only edit descriptive fields; status/assignment are rejected outright.
exports.update = [
  body(['status', 'assignedStaff', 'student', 'trackingCode', 'resolutionNote'])
    .not()
    .exists()
    .withMessage('You cannot change this field'),
  title().optional(),
  description().optional(),
  category().optional(),
  building().optional(),
  room(),
  priority(),
];

exports.listQuery = [
  query('status').optional().isIn(STATUSES).withMessage('Invalid status filter'),
  query('priority').optional().isIn(PRIORITIES).withMessage('Invalid priority filter'),
  query('category').optional().isMongoId().withMessage('Invalid category filter'),
  query('search').optional().isString().isLength({ max: 100 }),
  query('from').optional().isISO8601().withMessage('Invalid start date'),
  query('to').optional().isISO8601().withMessage('Invalid end date'),
  query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100'),
];

exports.statusChange = [
  body('status').isIn(STATUSES).withMessage('Invalid status'),
  note(),
  body('internal').optional().isBoolean(),
];

exports.assign = [
  body('staffId').isMongoId().withMessage('Please choose a staff member'),
  body('priority').optional({ values: 'falsy' }).isIn(PRIORITIES).withMessage('Invalid priority'),
  note(),
];

exports.priority = [body('priority').isIn(PRIORITIES).withMessage('Invalid priority'), note()];

exports.addNote = [
  body('note').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Note must be 1–2000 characters'),
  body('internal').optional().isBoolean(),
];

exports.feedback = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be a whole number from 1 to 5').toInt(),
  body('comment').optional().isString().trim().isLength({ max: 1000 }).withMessage('Comment must be at most 1000 characters'),
];

exports.reopenRequest = [
  body('reason').isString().trim().isLength({ min: 5, max: 1000 }).withMessage('Please explain why (5–1000 characters)'),
];
