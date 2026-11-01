const { Category, Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { sendSuccess, getPagination, buildMeta } = require('../utils/response');
const { assertObjectId } = require('../utils/access');

// GET /api/categories — active categories for everyone; admins may pass ?all=true
exports.listCategories = async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.all === 'true' ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ name: 1 }).select('-__v').lean();
  sendSuccess(res, { data: categories });
};

// GET /api/notifications
exports.listNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20, 50);
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  sendSuccess(res, { data: items, meta: { ...buildMeta(page, limit, total), unread } });
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  assertObjectId(req.params.id, 'notification id');
  const result = await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { isRead: true });
  if (!result.matchedCount) throw ApiError.notFound('Notification not found');
  sendSuccess(res, { message: 'Marked as read' });
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  sendSuccess(res, { message: 'All notifications marked as read' });
};
