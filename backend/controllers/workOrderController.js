const { WorkOrder, User, Setting, ComplaintStatusHistory } = require('../models');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const notify = require('../utils/notify');
const realtime = require('../utils/realtime');
const { sendSuccess } = require('../utils/response');
const { assertObjectId, loadAccessibleComplaint, isAssignedStaff } = require('../utils/access');

// Costs above these limits (BDT) need sign-off. Admins can change them in settings.
const DEFAULT_LIMITS = { deptHead: 5000, admin: 20000 };

async function getLimits() {
  const doc = await Setting.findById('workOrderLimits').lean();
  return { ...DEFAULT_LIMITS, ...(doc?.value || {}) };
}

const money = (n) => `৳${Number(n).toLocaleString('en-US')}`;

async function approversFor(role, department) {
  const filter = { role, isActive: true };
  if (role === 'dept_head') filter.department = department;
  return (await User.find(filter).select('_id').lean()).map((u) => u._id);
}

// GET /api/work-orders/limits
exports.limits = async (_req, res) => sendSuccess(res, { data: await getLimits() });

// PUT /api/admin/work-orders/limits
exports.setLimits = async (req, res) => {
  const value = { deptHead: req.body.deptHead, admin: req.body.admin };
  if (value.admin < value.deptHead) throw ApiError.badRequest('The admin limit must be at least the department head limit');
  await Setting.updateOne({ _id: 'workOrderLimits' }, { value }, { upsert: true });
  await audit(req, { action: 'settings.workorder_limits', entity: 'Setting', summary: `Approval limits: head > ${money(value.deptHead)}, admin > ${money(value.admin)}` });
  sendSuccess(res, { message: 'Approval limits saved', data: value });
};

// POST /api/complaints/:id/work-orders — assigned staff (or admin) raises a costed job
exports.create = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (!(req.user.role === 'admin' || isAssignedStaff(req.user, complaint))) {
    throw ApiError.forbidden('Only the assigned staff member or an admin can raise a work order');
  }
  if (['resolved', 'closed', 'rejected'].includes(complaint.status)) throw ApiError.badRequest('This complaint is no longer open');
  if (await WorkOrder.exists({ complaint: complaint._id, status: 'pending' })) throw ApiError.conflict('A work order is already waiting for approval');

  const { description, estimatedCost } = req.body;
  const limits = await getLimits();
  const required = [];
  if (estimatedCost > limits.deptHead) {
    // Departments without an active head go straight to the administrator.
    const heads = await approversFor('dept_head', complaint.department);
    required.push(heads.length ? 'dept_head' : 'admin');
  }
  if (estimatedCost > limits.admin && !required.includes('admin')) required.push('admin');

  const wo = await WorkOrder.create({
    complaint: complaint._id,
    department: complaint.department,
    createdBy: req.user._id,
    description,
    estimatedCost,
    requiredApprovals: required,
    status: required.length ? 'pending' : 'approved',
  });
  await ComplaintStatusHistory.create({
    complaint: complaint._id,
    changedBy: req.user._id,
    type: 'note',
    oldStatus: complaint.status,
    newStatus: complaint.status,
    note: `Work order raised: ${description} (est. ${money(estimatedCost)})${required.length ? ' — awaiting approval' : ' — auto-approved'}`,
    internal: true,
  });

  if (required.length) {
    await notify(await approversFor(required[0], complaint.department), {
      email: 'assignments',
      title: `Approval needed: ${complaint.trackingCode}`,
      message: `${req.user.name} requests ${money(estimatedCost)} — ${description}`,
      complaint,
    });
  }
  realtime.toComplaint(complaint._id, 'complaint:updated', { id: String(complaint._id), status: complaint.status });
  sendSuccess(res, {
    status: 201,
    message: required.length ? `Work order sent for approval (${required.map((r) => (r === 'admin' ? 'admin' : 'department head')).join(' → ')})` : 'Work order approved automatically (within limit)',
    data: wo,
  });
};

// GET /api/complaints/:id/work-orders
exports.forComplaint = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const rows = await WorkOrder.find({ complaint: complaint._id }).sort({ createdAt: -1 }).populate('createdBy', 'name role').populate('approvals.by', 'name role').lean();
  sendSuccess(res, { data: rows });
};

// GET /api/work-orders?status=pending — the approval inbox
exports.inbox = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  if (req.user.role === 'dept_head') filter.department = req.user.department;
  let rows = await WorkOrder.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('complaint', 'trackingCode title priority status location')
    .populate('createdBy', 'name')
    .populate('approvals.by', 'name role')
    .lean();
  rows = rows.map((w) => ({ ...w, nextApprover: w.status === 'pending' ? w.requiredApprovals[w.approvals.length] || null : null }));
  // "Waiting for me" first.
  rows.sort((a, b) => Number(b.nextApprover === req.user.role) - Number(a.nextApprover === req.user.role));
  sendSuccess(res, { data: rows });
};

// POST /api/work-orders/:id/decision — approve or reject at the current step
exports.decide = async (req, res) => {
  assertObjectId(req.params.id, 'work order id');
  const wo = await WorkOrder.findById(req.params.id).populate('complaint', 'trackingCode title status student assignedStaff');
  if (!wo) throw ApiError.notFound('Work order not found');
  const step = wo.nextApprover();
  if (!step) throw ApiError.badRequest('This work order is not waiting for approval');
  if (step !== req.user.role) throw ApiError.forbidden(`This step needs the ${step === 'admin' ? 'administrator' : 'department head'}`);
  if (step === 'dept_head' && wo.department !== req.user.department) throw ApiError.forbidden('This work order belongs to another department');

  const { decision, note = '' } = req.body;
  if (decision === 'rejected' && !note.trim()) throw ApiError.badRequest('Please give a reason for rejecting');

  // Guarded update so two approvers can't decide the same step twice.
  const updated = await WorkOrder.findOneAndUpdate(
    { _id: wo._id, status: 'pending', approvals: { $size: wo.approvals.length } },
    {
      $push: { approvals: { role: step, by: req.user._id, decision, note: note.trim() } },
      ...(decision === 'rejected' ? { status: 'rejected' } : wo.approvals.length + 1 >= wo.requiredApprovals.length ? { status: 'approved' } : {}),
    },
    { returnDocument: 'after' }
  );
  if (!updated) throw ApiError.conflict('Someone else already decided this step. Please refresh.');

  const complaint = wo.complaint;
  const next = updated.nextApprover();
  if (next) {
    await notify(await approversFor(next, wo.department), { email: 'assignments', title: `Approval needed: ${complaint.trackingCode}`, message: `Approved by the department head; final approval needed for ${money(wo.estimatedCost)}.`, complaint });
  }
  await notify([wo.createdBy], {
    title: `Work order ${updated.status === 'pending' ? 'approved at step 1' : updated.status}: ${complaint.trackingCode}`,
    message: `${req.user.name} ${decision} the ${money(wo.estimatedCost)} work order${note.trim() ? ` — ${note.trim()}` : ''}.`,
    complaint,
  });
  await audit(req, { action: `workorder.${decision}`, entity: 'WorkOrder', entityId: wo._id, summary: `${complaint.trackingCode}: ${decision} ${money(wo.estimatedCost)}` });
  realtime.toComplaint(complaint._id, 'complaint:updated', { id: String(complaint._id), status: complaint.status });
  sendSuccess(res, { message: `Work order ${decision}`, data: updated });
};

// POST /api/work-orders/:id/complete
exports.complete = async (req, res) => {
  assertObjectId(req.params.id, 'work order id');
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw ApiError.notFound('Work order not found');
  if (wo.status !== 'approved') throw ApiError.badRequest('Only approved work orders can be completed');
  if (req.user.role !== 'admin' && String(wo.createdBy) !== String(req.user._id)) throw ApiError.forbidden('Only the requester or an admin can complete it');
  wo.status = 'completed';
  await wo.save();
  sendSuccess(res, { message: 'Work order completed', data: wo });
};
