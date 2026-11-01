const { isValidObjectId, Types } = require('mongoose');
const { Complaint } = require('../models');
const { getPagination, buildMeta, escapeRegex } = require('./response');

/**
 * Builds a Mongo filter from list query params. `base` holds the
 * role-scoping conditions (e.g. { student: me }) and always wins.
 */
function buildFilter(query, base = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  // Cast ids explicitly: aggregation pipelines don't auto-cast like find() does.
  if (isValidObjectId(query.category)) filter.category = new Types.ObjectId(String(query.category));
  if (query.assignedStaff === 'unassigned') filter.assignedStaff = null;
  else if (isValidObjectId(query.assignedStaff)) filter.assignedStaff = new Types.ObjectId(String(query.assignedStaff));
  if (query.reopenRequested === 'true') filter['reopenRequest.requested'] = true;
  if (query.open === 'true') filter.status = { $nin: ['resolved', 'closed', 'rejected'] };

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const to = new Date(query.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) to.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = to;
    }
  }

  if (query.search?.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ title: rx }, { trackingCode: rx }, { 'location.building': rx }, { 'location.room': rx }];
  }
  return { ...filter, ...base };
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  priority: { priorityRank: -1, createdAt: -1 },
};

/** Runs a paginated, populated complaint list query. */
async function listComplaints(query, base, { studentFields = 'name', hideAnonymous = false } = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = buildFilter(query, base);
  const sortKey = SORTS[query.sort] ? query.sort : 'newest';

  let items;
  if (sortKey === 'priority') {
    // Sort by business priority rather than alphabetically.
    const ids = await Complaint.aggregate([
      { $match: filter },
      {
        $addFields: {
          priorityRank: { $indexOfArray: [['low', 'medium', 'high', 'critical'], '$priority'] },
        },
      },
      { $sort: SORTS.priority },
      { $skip: skip },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]);
    const order = ids.map((d) => String(d._id));
    const docs = await populateList(Complaint.find({ _id: { $in: order } }), studentFields);
    items = docs.sort((a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)));
  } else {
    items = await populateList(Complaint.find(filter).sort(SORTS[sortKey]).skip(skip).limit(limit), studentFields);
  }

  if (hideAnonymous) {
    items = items.map((c) => (c.isAnonymous ? { ...c, student: { name: 'Anonymous student' } } : c));
  }
  const total = await Complaint.countDocuments(filter);
  return { items, meta: buildMeta(page, limit, total) };
}

function populateList(q, studentFields) {
  return q
    .populate('category', 'name')
    .populate('assignedStaff', 'name')
    .populate('student', studentFields)
    .select('-__v')
    .lean();
}

/** Counts complaints by status for dashboard cards. */
async function statusCounts(match) {
  const rows = await Complaint.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const sum = (...keys) => keys.reduce((n, k) => n + (byStatus[k] || 0), 0);
  return {
    total: sum(...Object.keys(byStatus)),
    pending: sum('submitted', 'under_review', 'needs_information'),
    assigned: sum('assigned'),
    inProgress: sum('assigned', 'in_progress'),
    resolved: sum('resolved', 'closed'),
    rejected: sum('rejected'),
    byStatus,
  };
}

module.exports = { buildFilter, listComplaints, statusCounts };
