const { WorkOrder, Complaint } = require('../models');
const { sendSuccess } = require('../utils/response');
const { listComplaints, statusCounts } = require('../utils/complaintQuery');

// GET /api/dept/complaints — every complaint of my department
exports.complaints = async (req, res) => {
  const { items, meta } = await listComplaints(req.query, { department: req.user.department }, { studentFields: 'name studentId', hideAnonymous: true });
  sendSuccess(res, { data: items, meta });
};

// GET /api/dept/stats — dashboard numbers for the department head
exports.stats = async (req, res) => {
  const department = req.user.department;
  const now = new Date();
  const [counts, overdue, pendingApprovals, byCategory] = await Promise.all([
    statusCounts({ department }),
    Complaint.countDocuments({ department, status: { $in: ['submitted', 'under_review', 'needs_information', 'assigned', 'in_progress'] }, 'sla.resolveDueAt': { $lt: now } }),
    WorkOrder.find({ department, status: 'pending' }).select('requiredApprovals approvals').lean(),
    Complaint.aggregate([
      { $match: { department } },
      { $group: { _id: '$category', count: { $sum: 1 }, cost: { $sum: '$cost.parts' } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { _id: 0, category: { $ifNull: [{ $first: '$c.name' }, 'Unknown'] }, count: 1, cost: 1 } },
      { $sort: { count: -1 } },
    ]),
  ]);
  const waitingForMe = pendingApprovals.filter((w) => w.requiredApprovals[w.approvals.length] === 'dept_head').length;
  sendSuccess(res, { data: { department, counts, overdue, waitingForMe, byCategory, repairCost: byCategory.reduce((n, c) => n + c.cost, 0) } });
};
