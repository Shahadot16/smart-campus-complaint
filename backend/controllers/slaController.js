const { SlaPolicy, Complaint, JobRun } = require('../models');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const { sendSuccess } = require('../utils/response');
const { buildFilter } = require('../utils/complaintQuery');
const { DEFAULT_TARGETS } = require('../utils/sla');
const { PRIORITIES } = require('../utils/constants');
const scheduler = require('../jobs');

// GET /api/admin/sla-policies — general targets per priority + category overrides
exports.list = async (_req, res) => {
  const stored = await SlaPolicy.find().populate('category', 'name').lean();
  const general = PRIORITIES.map((priority) => {
    const p = stored.find((s) => s.priority === priority && !s.category);
    const [responseHours, resolveHours] = DEFAULT_TARGETS[priority];
    return p ? { ...p, isDefault: false } : { priority, responseHours, resolveHours, isDefault: true };
  });
  sendSuccess(res, { data: { general, overrides: stored.filter((s) => s.category) } });
};

// PUT /api/admin/sla-policies — upsert one policy (general when category is empty)
exports.upsert = async (req, res) => {
  const { priority, responseHours, resolveHours } = req.body;
  const category = req.body.category || null;
  if (Number(resolveHours) < Number(responseHours)) throw ApiError.badRequest('Resolution time must be at least the response time');
  const policy = await SlaPolicy.findOneAndUpdate(
    { priority, category },
    { responseHours, resolveHours },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  await audit(req, {
    action: 'sla.update',
    entity: 'SlaPolicy',
    entityId: policy._id,
    summary: `SLA ${priority}${category ? ' (category override)' : ''}: respond ${responseHours}h, resolve ${resolveHours}h`,
  });
  sendSuccess(res, { message: 'SLA policy saved. New complaints will use it.', data: policy });
};

// DELETE /api/admin/sla-policies/:id
exports.remove = async (req, res) => {
  const policy = await SlaPolicy.findByIdAndDelete(req.params.id);
  if (!policy) throw ApiError.notFound('Policy not found');
  await audit(req, { action: 'sla.delete', entity: 'SlaPolicy', entityId: policy._id, summary: `Removed SLA policy for ${policy.priority}` });
  sendSuccess(res, { message: 'Policy removed' });
};

// GET /api/admin/reports/sla?from=&to=
exports.report = async (req, res) => {
  const match = buildFilter({ from: req.query.from, to: req.query.to });
  const now = new Date();
  const onTime = { $cond: [{ $and: [{ $ne: ['$resolvedAt', null] }, { $lte: ['$resolvedAt', '$sla.resolveDueAt'] }] }, 1, 0] };
  const late = { $cond: ['$sla.resolveBreached', 1, 0] };
  const group = (key) => [
    { $match: { ...match, 'sla.resolveDueAt': { $ne: null } } },
    { $group: { _id: key, total: { $sum: 1 }, onTime: { $sum: onTime }, breached: { $sum: late } } },
  ];

  const [overall, byCategory, byStaff, byPriority, responses, overdueNow] = await Promise.all([
    Complaint.aggregate(group(null)),
    Complaint.aggregate([
      ...group('$category'),
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { _id: 0, label: { $ifNull: [{ $first: '$c.name' }, 'Unknown'] }, total: 1, onTime: 1, breached: 1 } },
      { $sort: { breached: -1 } },
    ]),
    Complaint.aggregate([
      { $match: { ...match, assignedStaff: { $ne: null }, 'sla.resolveDueAt': { $ne: null } } },
      { $group: { _id: '$assignedStaff', total: { $sum: 1 }, onTime: { $sum: onTime }, breached: { $sum: late } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 0, label: { $ifNull: [{ $first: '$u.name' }, 'Unknown'] }, total: 1, onTime: 1, breached: 1 } },
      { $sort: { breached: -1 } },
    ]),
    Complaint.aggregate([...group('$priority'), { $project: { _id: 0, label: '$_id', total: 1, onTime: 1, breached: 1 } }]),
    Complaint.aggregate([
      { $match: { ...match, 'sla.responseDueAt': { $ne: null } } },
      { $group: { _id: null, total: { $sum: 1 }, breached: { $sum: { $cond: ['$sla.responseBreached', 1, 0] } } } },
    ]),
    Complaint.countDocuments({ status: { $in: ['submitted', 'under_review', 'needs_information', 'assigned', 'in_progress'] }, 'sla.resolveDueAt': { $lt: now } }),
  ]);

  const o = overall[0] || { total: 0, onTime: 0, breached: 0 };
  const r = responses[0] || { total: 0, breached: 0 };
  sendSuccess(res, {
    data: {
      resolution: { total: o.total, onTime: o.onTime, breached: o.breached, compliance: o.total ? Math.round(((o.total - o.breached) / o.total) * 100) : null },
      response: { total: r.total, breached: r.breached, compliance: r.total ? Math.round(((r.total - r.breached) / r.total) * 100) : null },
      overdueNow,
      byCategory,
      byStaff,
      byPriority: PRIORITIES.map((p) => byPriority.find((x) => x.label === p) || { label: p, total: 0, onTime: 0, breached: 0 }),
    },
  });
};

// GET /api/admin/jobs — background job status
exports.jobs = async (_req, res) => {
  const runs = await JobRun.find().lean();
  sendSuccess(res, {
    data: scheduler.jobs.map((j) => {
      const r = runs.find((x) => x._id === j.name) || {};
      return { name: j.name, everyMinutes: j.everyMs / 60000, lastRunAt: r.lastRunAt || null, lastResult: r.lastResult ?? null, lastError: r.lastError || '' };
    }),
  });
};

// POST /api/admin/jobs/:name/run — run a job now (useful for demos)
exports.runJob = async (req, res) => {
  const job = scheduler.getJob(req.params.name);
  if (!job) throw ApiError.notFound('Unknown job');
  const result = await scheduler.runJob(job);
  await audit(req, { action: 'job.run', entity: 'Job', summary: `Ran ${job.name} manually` });
  sendSuccess(res, { message: result === null ? 'Job is already running' : 'Job finished', data: result });
};
