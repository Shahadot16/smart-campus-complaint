const { Category, Complaint, Feedback } = require('../models');
const ai = require('../utils/ai');
const { sendSuccess } = require('../utils/response');
const { canAccessComplaint, loadAccessibleComplaint } = require('../utils/access');
const { STATUS_LABELS } = require('../utils/workflow');
const { getTargets } = require('../utils/sla');

const OPEN = ['submitted', 'under_review', 'needs_information', 'assigned', 'in_progress'];

// GET /api/ai/status — whether Claude is configured (UI shows "AI" vs "smart rules")
exports.status = (_req, res) => sendSuccess(res, { data: { claude: ai.aiEnabled() } });

// POST /api/ai/classify — suggested category and priority for a draft complaint
exports.classify = async (req, res) => {
  const categories = await Category.find({ isActive: true }).select('name').lean();
  const result = await ai.classify(req.body, categories.map((c) => c.name));
  const match = categories.find((c) => c.name === result.category);
  sendSuccess(res, { data: { ...result, categoryId: match?._id || null } });
};

async function findSimilar(draft, excludeId = null) {
  const since = new Date(Date.now() - 30 * 864e5);
  const filter = { status: { $in: OPEN }, createdAt: { $gte: since } };
  if (excludeId) filter._id = { $ne: excludeId };
  const candidates = await Complaint.find(filter)
    .sort({ createdAt: -1 })
    .limit(300)
    .select('trackingCode title description status priority location category createdAt votes student')
    .populate('category', 'name')
    .lean();
  return candidates
    .map((c) => ({ c, score: ai.similarity(draft, c) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ c, score }) => ({
      _id: c._id,
      trackingCode: c.trackingCode,
      title: c.title,
      status: c.status,
      priority: c.priority,
      location: c.location,
      category: c.category?.name,
      createdAt: c.createdAt,
      votes: c.votes || 0,
      score,
      mine: String(c.student) === String(draft.userId),
    }));
}

// POST /api/ai/similar — possible duplicates of a complaint being written
exports.similarDraft = async (req, res) => {
  const { title = '', description = '', category, building, room } = req.body;
  sendSuccess(res, { data: await findSimilar({ title, description, category, building, room, userId: req.user._id }) });
};

// GET /api/complaints/:id/similar — possible duplicates of an existing complaint (staff/admin view)
exports.similarTo = async (req, res) => {
  const c = await loadAccessibleComplaint(req.params.id, req.user);
  const rows = await findSimilar({ title: c.title, description: c.description, category: c.category, building: c.location.building, room: c.location.room }, c._id);
  sendSuccess(res, { data: req.user.role === 'student' ? [] : rows });
};

/* -------------------------------- Chatbot ------------------------------- */

const HOME = { student: '/student', staff: '/staff', admin: '/admin', dept_head: '/dept' };

// POST /api/ai/chat — help assistant: tracking lookups, my open complaints, how-to answers
exports.chat = async (req, res) => {
  const text = String(req.body.message || '').trim();
  const user = req.user;
  const reply = (message, links = []) => sendSuccess(res, { data: { reply: message, links } });

  // 1) A tracking code anywhere in the message.
  const code = text.match(/CMP-\d{4}-\d{4}/i)?.[0]?.toUpperCase();
  if (code) {
    const c = await Complaint.findOne({ trackingCode: code }).populate('assignedStaff', 'name');
    if (!c || !canAccessComplaint(user, c)) return reply(`I couldn't find ${code} in your account. Please check the tracking ID.`);
    const who = c.assignedStaff ? ` It is assigned to ${c.assignedStaff.name}.` : '';
    const due = c.sla?.resolveDueAt && OPEN.includes(c.status) ? ` Target resolution: ${c.sla.resolveDueAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.` : '';
    return reply(`${code} "${c.title}" is ${STATUS_LABELS[c.status]}.${who}${due}`, [{ label: `Open ${code}`, to: `/complaints/${c._id}` }]);
  }

  const lower = text.toLowerCase();
  const mineFilter = user.role === 'student' ? { student: user._id } : user.role === 'staff' ? { assignedStaff: user._id } : user.role === 'dept_head' ? { department: user.department } : {};
  const myOpen = await Complaint.find({ ...mineFilter, status: { $in: OPEN } }).sort({ createdAt: -1 }).limit(5).select('trackingCode title status').lean();

  // 2) "What's the status of my complaints?"
  if (/status|my complaint|update|progress|pending|open|tasks|অবস্থা|আপডেট/.test(lower)) {
    if (!myOpen.length) return reply('You have no open complaints right now. 🎉', [{ label: 'Dashboard', to: HOME[user.role] }]);
    const list = myOpen.map((c) => `${c.trackingCode} — ${STATUS_LABELS[c.status]}`).join('; ');
    return reply(`You have ${myOpen.length} open complaint(s): ${list}.`, myOpen.slice(0, 3).map((c) => ({ label: c.trackingCode, to: `/complaints/${c._id}` })));
  }

  // 3) How to report / how long it takes.
  if (/how (do|can|to)|report|submit|new complaint|কিভাবে|অভিযোগ/.test(lower) && user.role === 'student') {
    return reply('Tap "New Complaint", choose the category and the building/room (or scan the QR sticker in the room), describe the problem and add a photo. You\'ll get a tracking ID and live updates.', [{ label: 'New complaint', to: '/student/new' }]);
  }
  if (/how long|deadline|sla|time|when|কতদিন|কখন/.test(lower)) {
    const t = await Promise.all(['critical', 'high', 'medium', 'low'].map(async (p) => [p, await getTargets(p)]));
    return reply(`Target resolution times: ${t.map(([p, x]) => `${p} within ${x.resolveHours}h`).join(', ')}. Overdue complaints are escalated automatically.`);
  }

  // 4) Anything else: Claude (if configured) with the user's complaints as context.
  const answer = await ai.chatAnswer(text, { role: user.role, name: user.name, openComplaints: myOpen });
  if (answer) return reply(answer);
  return reply('I can help with: the status of a complaint (send its tracking ID, e.g. CMP-2026-0001), "my complaints", how to report an issue, and how long fixes take.');
};

/* ------------------------------ Weekly summary --------------------------- */

// GET /api/admin/ai/summary — briefing on the last 7 days
exports.weeklySummary = async (_req, res) => {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 864e5);
  const twoWeeksAgo = new Date(now - 14 * 864e5);
  const [created, previous, resolved, overdue, byCat, byBuilding, feedback] = await Promise.all([
    Complaint.countDocuments({ createdAt: { $gte: weekAgo } }),
    Complaint.countDocuments({ createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } }),
    Complaint.countDocuments({ resolvedAt: { $gte: weekAgo } }),
    Complaint.countDocuments({ status: { $in: OPEN }, 'sla.resolveDueAt': { $lt: new Date() } }),
    Complaint.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
    ]),
    Complaint.aggregate([{ $match: { createdAt: { $gte: weekAgo } } }, { $group: { _id: '$location.building', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]),
    Feedback.find({ createdAt: { $gte: weekAgo } }).select('rating comment').lean(),
  ]);
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const f of feedback) sentiment[ai.sentiment(f.rating, f.comment)] += 1;
  const stats = {
    created,
    resolved,
    overdue,
    change: previous ? Math.round(((created - previous) / previous) * 100) : created ? 100 : 0,
    topCategory: byCat[0] ? { name: byCat[0].c[0]?.name || 'Unknown', count: byCat[0].count } : null,
    topBuilding: byBuilding[0] ? { name: byBuilding[0]._id, count: byBuilding[0].count } : null,
    sentiment: feedback.length ? sentiment : null,
  };
  sendSuccess(res, { data: { ...(await ai.summarize(stats)), stats } });
};
