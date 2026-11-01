const ExcelJS = require('exceljs');
const { Complaint, Feedback } = require('../models');
const { sendSuccess } = require('../utils/response');
const { buildFilter } = require('../utils/complaintQuery');
const { sentiment } = require('../utils/ai');
const { STATUS_LABELS } = require('../utils/workflow');

const TZ = 'Asia/Dhaka';

// GET /api/admin/analytics?from=&to= — data for the interactive analytics page
exports.analytics = async (req, res) => {
  const match = buildFilter({ from: req.query.from, to: req.query.to });
  const resolvedMatch = { resolvedAt: { $ne: null } };
  if (match.createdAt) resolvedMatch.resolvedAt = { ...match.createdAt, $ne: null };

  const [created, resolved, heat, leaderboard, byCategory, feedback] = await Promise.all([
    Complaint.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, n: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: resolvedMatch }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt', timezone: TZ } }, n: { $sum: 1 } } }]),
    // 1 = Sunday … 7 = Saturday (MongoDB), hours in Dhaka time
    Complaint.aggregate([
      { $match: match },
      { $group: { _id: { d: { $dayOfWeek: { date: '$createdAt', timezone: TZ } }, h: { $hour: { date: '$createdAt', timezone: TZ } } }, n: { $sum: 1 } } },
    ]),
    Complaint.aggregate([
      { $match: { ...match, assignedStaff: { $ne: null } } },
      {
        $group: {
          _id: '$assignedStaff',
          assigned: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $ne: ['$resolvedAt', null] }, 1, 0] } },
          onTime: { $sum: { $cond: [{ $and: [{ $ne: ['$resolvedAt', null] }, { $not: ['$sla.resolveBreached'] }] }, 1, 0] } },
          avgMs: { $avg: { $cond: [{ $ne: ['$resolvedAt', null] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } },
          partsCost: { $sum: '$cost.parts' },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 1, name: { $first: '$u.name' }, assigned: 1, resolved: 1, onTime: 1, avgMs: 1, partsCost: 1 } },
    ]),
    Complaint.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgMs: { $avg: { $cond: [{ $ne: ['$resolvedAt', null] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } },
        },
      },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { _id: 0, category: { $ifNull: [{ $first: '$c.name' }, 'Unknown'] }, count: 1, avgMs: 1 } },
      { $sort: { count: -1 } },
    ]),
    Feedback.aggregate([
      { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $match: Object.fromEntries(Object.entries(match).map(([k, v]) => [`c.${k}`, v])) },
      { $project: { rating: 1, comment: 1, staff: '$c.assignedStaff' } },
    ]),
  ]);

  // Daily series with zero-filled gaps.
  const days = [...new Set([...created.map((d) => d._id), ...resolved.map((d) => d._id)])].sort();
  const trend = [];
  if (days.length) {
    const c = Object.fromEntries(created.map((d) => [d._id, d.n]));
    const r = Object.fromEntries(resolved.map((d) => [d._id, d.n]));
    for (let t = new Date(`${days[0]}T00:00:00Z`); t <= new Date(`${days.at(-1)}T00:00:00Z`); t = new Date(t.getTime() + 864e5)) {
      const key = t.toISOString().slice(0, 10);
      trend.push({ date: key, created: c[key] || 0, resolved: r[key] || 0 });
    }
  }

  const ratingBy = {};
  const mood = { positive: 0, neutral: 0, negative: 0 };
  for (const f of feedback) {
    mood[sentiment(f.rating, f.comment)] += 1;
    if (f.staff) (ratingBy[String(f.staff)] ||= []).push(f.rating);
  }
  const hours = (ms) => (ms == null ? null : Math.round((ms / 36e5) * 10) / 10);

  sendSuccess(res, {
    data: {
      trend,
      heatmap: heat.map((h) => ({ day: h._id.d, hour: h._id.h, count: h.n })),
      byCategory: byCategory.map((c) => ({ category: c.category, count: c.count, avgHours: hours(c.avgMs) })),
      leaderboard: leaderboard
        .map((s) => {
          const ratings = ratingBy[String(s._id)] || [];
          return {
            name: s.name || 'Unknown',
            assigned: s.assigned,
            resolved: s.resolved,
            avgHours: hours(s.avgMs),
            slaOnTime: s.resolved ? Math.round((s.onTime / s.resolved) * 100) : null,
            rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
            partsCost: s.partsCost,
          };
        })
        .sort((a, b) => b.resolved - a.resolved),
      sentiment: mood,
    },
  });
};

// GET /api/admin/reports/export.xlsx?from=&to= — complaint register as an Excel workbook
exports.exportExcel = async (req, res) => {
  const match = buildFilter({ from: req.query.from, to: req.query.to });
  const rows = await Complaint.find(match)
    .sort({ createdAt: -1 })
    .limit(5000)
    .populate('category', 'name')
    .populate('student', 'name studentId')
    .populate('assignedStaff', 'name')
    .lean();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IUBAT Smart Campus';
  const ws = wb.addWorksheet('Complaints', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Tracking ID', key: 'code', width: 16 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Department', key: 'dept', width: 11 },
    { header: 'Building', key: 'building', width: 26 },
    { header: 'Room', key: 'room', width: 22 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Student', key: 'student', width: 22 },
    { header: 'Assigned to', key: 'staff', width: 20 },
    { header: 'Created', key: 'created', width: 18, style: { numFmt: 'dd mmm yyyy hh:mm' } },
    { header: 'Resolved', key: 'resolved', width: 18, style: { numFmt: 'dd mmm yyyy hh:mm' } },
    { header: 'SLA met', key: 'sla', width: 9 },
    { header: 'Parts cost (BDT)', key: 'cost', width: 15 },
  ];
  for (const c of rows) {
    ws.addRow({
      code: c.trackingCode,
      title: c.title,
      category: c.category?.name || '',
      dept: c.department || '',
      building: c.location?.building || '',
      room: c.location?.room || '',
      priority: c.priority,
      status: STATUS_LABELS[c.status],
      student: c.student ? `${c.student.name} (${c.student.studentId || ''})` : '',
      staff: c.assignedStaff?.name || '',
      created: c.createdAt,
      resolved: c.resolvedAt || null,
      sla: c.sla?.resolveDueAt ? (c.sla.resolveBreached ? 'No' : c.resolvedAt ? 'Yes' : '—') : '',
      cost: c.cost?.parts || 0,
    });
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A4029' } };
  ws.autoFilter = { from: 'A1', to: 'N1' };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="iubat-complaints-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};
