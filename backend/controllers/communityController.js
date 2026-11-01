const { Complaint, Vote, ComplaintStatusHistory, User } = require('../models');
const ApiError = require('../utils/ApiError');
const notify = require('../utils/notify');
const realtime = require('../utils/realtime');
const { sendSuccess, getPagination, buildMeta, escapeRegex } = require('../utils/response');
const { assertObjectId } = require('../utils/access');
const { nextPriority } = require('../utils/sla');

const OPEN = ['submitted', 'under_review', 'needs_information', 'assigned', 'in_progress'];
// When this many students say "me too", the priority goes up one step (once).
const VOTES_TO_ESCALATE = 5;

// GET /api/public/complaints — campus issue board (no reporter details)
exports.board = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 12, 50);
  const filter = { visibility: 'public', status: { $in: req.query.status === 'resolved' ? ['resolved', 'closed'] : OPEN } };
  if (req.query.building) filter['location.building'] = String(req.query.building);
  if (req.query.search?.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ title: rx }, { 'location.building': rx }, { 'location.room': rx }];
  }
  const sort = req.query.sort === 'newest' ? { createdAt: -1 } : { votes: -1, createdAt: -1 };
  const [items, total] = await Promise.all([
    Complaint.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('trackingCode title description location category status priority votes createdAt student')
      .populate('category', 'name')
      .lean(),
    Complaint.countDocuments(filter),
  ]);
  const myVotes = new Set((await Vote.find({ user: req.user._id, complaint: { $in: items.map((c) => c._id) } }).select('complaint').lean()).map((v) => String(v.complaint)));
  sendSuccess(res, {
    data: items.map(({ student, ...c }) => ({ ...c, mine: String(student) === String(req.user._id), voted: myVotes.has(String(c._id)) })),
    meta: buildMeta(page, limit, total),
  });
};

async function loadVotable(id, user) {
  assertObjectId(id, 'complaint id');
  const c = await Complaint.findById(id);
  if (!c || c.visibility !== 'public') throw ApiError.notFound('Complaint not found');
  if (String(c.student) === String(user._id)) throw ApiError.badRequest('You reported this complaint yourself');
  if (!OPEN.includes(c.status)) throw ApiError.badRequest('This complaint is already closed');
  return c;
}

// POST /api/complaints/:id/vote — "me too"
exports.vote = async (req, res) => {
  const c = await loadVotable(req.params.id, req.user);
  try {
    await Vote.create({ complaint: c._id, user: req.user._id });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('You already said "me too" for this complaint');
    throw err;
  }
  const updated = await Complaint.findByIdAndUpdate(c._id, { $inc: { votes: 1 } }, { returnDocument: 'after' });

  // Popular problems get attention: raise priority once at the threshold.
  if (updated.votes >= VOTES_TO_ESCALATE && !updated.votesEscalated && updated.priority !== 'critical') {
    const from = updated.priority;
    const raised = await Complaint.findOneAndUpdate(
      { _id: c._id, votesEscalated: false },
      { priority: nextPriority(from), votesEscalated: true },
      { returnDocument: 'after' }
    );
    if (raised) {
      await ComplaintStatusHistory.create({
        complaint: c._id, changedBy: null, type: 'priority', oldStatus: raised.status, newStatus: raised.status,
        note: `Priority raised from ${from} to ${raised.priority}: ${raised.votes} students reported the same problem.`,
      });
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
      await notify([...admins.map((a) => a._id), raised.assignedStaff], { title: `${raised.trackingCode} is affecting many students`, message: `${raised.votes} students said "me too". Priority raised to ${raised.priority}.`, complaint: raised });
    }
  }
  await notify([c.student], { title: `Others have the same problem (${c.trackingCode})`, message: `${updated.votes} student(s) said "me too" on your complaint.`, complaint: c });
  realtime.toComplaint(c._id, 'complaint:updated', { id: String(c._id), status: c.status });
  sendSuccess(res, { status: 201, message: 'Thanks — your vote helps prioritise this issue', data: { votes: updated.votes } });
};

// DELETE /api/complaints/:id/vote
exports.unvote = async (req, res) => {
  assertObjectId(req.params.id, 'complaint id');
  const removed = await Vote.findOneAndDelete({ complaint: req.params.id, user: req.user._id });
  if (!removed) throw ApiError.notFound('You have not voted for this complaint');
  const updated = await Complaint.findOneAndUpdate({ _id: req.params.id, votes: { $gt: 0 } }, { $inc: { votes: -1 } }, { returnDocument: 'after' });
  sendSuccess(res, { message: 'Vote removed', data: { votes: updated?.votes ?? 0 } });
};

// GET /api/leaderboard — top reporters (students) and fixers (staff) this month
exports.leaderboard = async (_req, res) => {
  const since = new Date(Date.now() - 30 * 864e5);
  const [reporters, fixers] = await Promise.all([
    Complaint.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'rejected' }, isAnonymous: { $ne: true } } },
      { $group: { _id: '$student', reports: { $sum: 1 }, votes: { $sum: '$votes' } } },
      { $addFields: { points: { $add: [{ $multiply: ['$reports', 10] }, { $multiply: ['$votes', 2] }] } } },
      { $sort: { points: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 0, name: { $first: '$u.name' }, department: { $first: '$u.department' }, reports: 1, votes: 1, points: 1 } },
    ]),
    Complaint.aggregate([
      { $match: { resolvedAt: { $gte: since }, assignedStaff: { $ne: null } } },
      { $group: { _id: '$assignedStaff', fixed: { $sum: 1 }, onTime: { $sum: { $cond: ['$sla.resolveBreached', 0, 1] } } } },
      { $addFields: { points: { $add: [{ $multiply: ['$fixed', 10] }, { $multiply: ['$onTime', 5] }] } } },
      { $sort: { points: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 0, name: { $first: '$u.name' }, fixed: 1, onTime: 1, points: 1 } },
    ]),
  ]);
  sendSuccess(res, { data: { reporters, fixers } });
};
