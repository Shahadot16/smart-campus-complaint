const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');
const { changeStatus } = require('../utils/complaintService');
const { listComplaints, statusCounts } = require('../utils/complaintQuery');
const { loadAccessibleComplaint, isAssignedStaff } = require('../utils/access');

// GET /api/staff/complaints — only complaints assigned to me
exports.listAssigned = async (req, res) => {
  const { items, meta } = await listComplaints(req.query, { assignedStaff: req.user._id }, { studentFields: 'name department', hideAnonymous: true });
  sendSuccess(res, { data: items, meta });
};

// GET /api/staff/stats
exports.stats = async (req, res) => {
  const counts = await statusCounts({ assignedStaff: req.user._id });
  sendSuccess(res, { data: { counts } });
};

// PATCH /api/staff/complaints/:id/status — assigned → in_progress → resolved
exports.changeStatus = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (!isAssignedStaff(req.user, complaint)) {
    throw ApiError.forbidden('You can only update complaints assigned to you');
  }
  const updated = await changeStatus({
    complaint,
    actor: req.user,
    newStatus: req.body.status,
    note: req.body.note || '',
  });
  sendSuccess(res, { message: 'Work status updated', data: { id: updated._id, status: updated.status } });
};
