const { Complaint, Category, User, Feedback } = require('../models');
const ApiError = require('../utils/ApiError');
const { sendSuccess, getPagination, buildMeta, escapeRegex } = require('../utils/response');
const { changeStatus, assignStaff, commitChange } = require('../utils/complaintService');
const { listComplaints, statusCounts, buildFilter } = require('../utils/complaintQuery');
const { loadAccessibleComplaint, assertObjectId } = require('../utils/access');
const { profile } = require('./authController');

/* ----------------------------- Complaints ----------------------------- */

// GET /api/admin/complaints
exports.listComplaints = async (req, res) => {
  const { items, meta } = await listComplaints(req.query, {}, { studentFields: 'name studentId' });
  const counts = await statusCounts(buildFilter({ ...req.query, status: undefined, open: undefined }));
  sendSuccess(res, { data: items, meta: { ...meta, counts } });
};

// PATCH /api/admin/complaints/:id/status
exports.changeStatus = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const updated = await changeStatus({
    complaint,
    actor: req.user,
    newStatus: req.body.status,
    note: req.body.note || '',
    internal: req.body.internal,
  });
  sendSuccess(res, { message: 'Status updated', data: { id: updated._id, status: updated.status } });
};

// PATCH /api/admin/complaints/:id/assign
exports.assign = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const updated = await assignStaff({
    complaint,
    actor: req.user,
    staffId: req.body.staffId,
    priority: req.body.priority,
    note: req.body.note || '',
  });
  sendSuccess(res, {
    message: 'Staff assigned successfully',
    data: { id: updated._id, status: updated.status, assignedStaff: updated.assignedStaff, priority: updated.priority },
  });
};

// PATCH /api/admin/complaints/:id/priority
exports.setPriority = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const { priority, note = '' } = req.body;
  if (['closed', 'rejected'].includes(complaint.status)) throw ApiError.badRequest('This complaint is no longer active');
  if (priority === complaint.priority) throw ApiError.badRequest(`Priority is already ${priority}`);

  const updated = await commitChange(complaint, complaint.status, { priority }, [
    {
      changedBy: req.user._id,
      type: 'priority',
      oldStatus: complaint.status,
      newStatus: complaint.status,
      note: `Priority changed from ${complaint.priority} to ${priority}${note.trim() ? ` — ${note.trim()}` : ''}`,
    },
  ]);
  sendSuccess(res, { message: 'Priority updated', data: { id: updated._id, priority: updated.priority } });
};

/* -------------------------------- Users ------------------------------- */

// GET /api/admin/users
exports.listUsers = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.active) filter.isActive = req.query.active === 'true';
  if (req.query.search?.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { studentId: rx }, { department: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  sendSuccess(res, { data: users.map(profile), meta: buildMeta(page, limit, total) });
};

// GET /api/admin/staff — active staff with their current open workload
exports.listStaff = async (_req, res) => {
  const staff = await User.find({ role: 'staff', isActive: true }).sort({ name: 1 }).lean();
  const load = await Complaint.aggregate([
    { $match: { assignedStaff: { $ne: null }, status: { $in: ['assigned', 'in_progress'] } } },
    { $group: { _id: '$assignedStaff', open: { $sum: 1 } } },
  ]);
  const byId = Object.fromEntries(load.map((l) => [String(l._id), l.open]));
  sendSuccess(res, {
    data: staff.map((s) => ({ id: s._id, name: s.name, email: s.email, department: s.department, openTasks: byId[String(s._id)] || 0 })),
  });
};

// POST /api/admin/users — trusted admin workflow for creating staff/admin accounts
exports.createUser = async (req, res) => {
  const { name, email, password, role, department, phone } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('Email already exists');
  const user = new User({ name, email, role, department, phone });
  await user.setPassword(password);
  await user.save();
  sendSuccess(res, { status: 201, message: `${role === 'admin' ? 'Admin' : 'Staff'} account created`, data: profile(user) });
};

// PATCH /api/admin/users/:id — activate/deactivate, change role or details
exports.updateUser = async (req, res) => {
  assertObjectId(req.params.id, 'user id');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  const isSelf = String(user._id) === String(req.user._id);
  if (isSelf && (req.body.isActive === false || (req.body.role && req.body.role !== 'admin'))) {
    throw ApiError.badRequest('You cannot deactivate or demote your own account');
  }
  if (req.body.role === 'student' && user.role !== 'student') {
    throw ApiError.badRequest('Staff and admin accounts cannot be converted to students');
  }
  if (req.body.role && req.body.role !== 'student' && user.role === 'student') {
    throw ApiError.badRequest('Create a separate staff/admin account instead of promoting a student');
  }

  // Deactivating staff with open work would strand complaints.
  if (req.body.isActive === false && user.role === 'staff') {
    const open = await Complaint.countDocuments({ assignedStaff: user._id, status: { $in: ['assigned', 'in_progress'] } });
    if (open) throw ApiError.conflict(`Reassign this staff member's ${open} open complaint(s) before deactivating`);
  }

  for (const field of ['name', 'department', 'phone', 'isActive', 'role']) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  await user.save();
  sendSuccess(res, { message: 'User updated', data: profile(user) });
};

/* ----------------------------- Categories ----------------------------- */

// POST /api/admin/categories
exports.createCategory = async (req, res) => {
  const name = req.body.name.trim();
  if (await Category.exists({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') })) {
    throw ApiError.conflict('A category with this name already exists');
  }
  const category = await Category.create({ name, description: req.body.description || '' });
  sendSuccess(res, { status: 201, message: 'Category created', data: category });
};

// PATCH /api/admin/categories/:id — categories are deactivated, never deleted
exports.updateCategory = async (req, res) => {
  assertObjectId(req.params.id, 'category id');
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');

  if (req.body.name && req.body.name.trim().toLowerCase() !== category.name.toLowerCase()) {
    const clash = await Category.exists({
      _id: { $ne: category._id },
      name: new RegExp(`^${escapeRegex(req.body.name.trim())}$`, 'i'),
    });
    if (clash) throw ApiError.conflict('A category with this name already exists');
  }
  for (const field of ['name', 'description', 'isActive']) {
    if (req.body[field] !== undefined) category[field] = req.body[field];
  }
  await category.save();
  sendSuccess(res, { message: 'Category updated', data: category });
};

/* ------------------------------- Reports ------------------------------ */

// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.reports = async (req, res) => {
  const match = buildFilter({ from: req.query.from, to: req.query.to });

  const [counts, byCategory, byPriority, trend, resolution, feedback, staffLoad, buildings] = await Promise.all([
    statusCounts(match),
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
      { $project: { _id: 0, category: { $ifNull: [{ $first: '$cat.name' }, 'Unknown'] }, count: 1 } },
      { $sort: { count: -1 } },
    ]),
    Complaint.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]),
    Complaint.aggregate([
      { $match: { ...match, resolvedAt: { $ne: null } } },
      { $group: { _id: null, avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } }, count: { $sum: 1 } } },
    ]),
    Feedback.aggregate([
      { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'c' } },
      { $match: Object.fromEntries(Object.entries(match).map(([k, v]) => [`c.${k}`, v])) },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
    Complaint.aggregate([
      { $match: { ...match, assignedStaff: { $ne: null } } },
      {
        $group: {
          _id: '$assignedStaff',
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ['$status', ['assigned', 'in_progress']] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 0, staff: { $first: '$u.name' }, total: 1, open: 1, resolved: 1 } },
      { $sort: { total: -1 } },
    ]),
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: '$location.building', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, building: '$_id', count: 1 } },
    ]),
  ]);

  const ratingCounts = Object.fromEntries(feedback.map((f) => [f._id, f.count]));
  const ratingTotal = feedback.reduce((n, f) => n + f.count, 0);
  const ratingSum = feedback.reduce((n, f) => n + f._id * f.count, 0);

  sendSuccess(res, {
    data: {
      range: { from: req.query.from || null, to: req.query.to || null },
      counts,
      byCategory,
      byPriority: Object.fromEntries(byPriority.map((p) => [p._id, p.count])),
      trend,
      topBuildings: buildings,
      staffPerformance: staffLoad,
      resolution: {
        resolvedCount: resolution[0]?.count || 0,
        avgHours: resolution[0] ? Math.round((resolution[0].avgMs / 36e5) * 10) / 10 : null,
      },
      feedback: {
        count: ratingTotal,
        average: ratingTotal ? Math.round((ratingSum / ratingTotal) * 10) / 10 : null,
        distribution: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: ratingCounts[r] || 0 })),
      },
    },
  });
};
