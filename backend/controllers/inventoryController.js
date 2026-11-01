const { SparePart, StockMovement, Complaint, ComplaintStatusHistory, User } = require('../models');
const { withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const notify = require('../utils/notify');
const realtime = require('../utils/realtime');
const { sendSuccess, escapeRegex } = require('../utils/response');
const { assertObjectId, loadAccessibleComplaint, isAssignedStaff } = require('../utils/access');

// GET /api/parts?search=&lowStock=true — staff pick parts from this list
exports.list = async (req, res) => {
  const filter = req.query.all === 'true' && req.user.role === 'admin' ? {} : { isActive: true };
  if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$minQuantity'] };
  if (req.query.search?.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: rx }, { sku: rx }];
  }
  const parts = await SparePart.find(filter).sort({ name: 1 }).lean();
  sendSuccess(res, { data: parts.map((p) => ({ ...p, lowStock: p.quantity <= p.minQuantity })) });
};

// POST /api/admin/parts
exports.create = async (req, res) => {
  if (await SparePart.exists({ sku: req.body.sku.toUpperCase() })) throw ApiError.conflict('A part with this SKU already exists');
  const { sku, name, unit, minQuantity, unitCost, supplier } = req.body;
  const part = await SparePart.create({ sku, name, unit, minQuantity, unitCost, supplier, quantity: 0 });
  await audit(req, { action: 'part.create', entity: 'SparePart', entityId: part._id, summary: `Added part ${part.sku} (${part.name})` });
  sendSuccess(res, { status: 201, message: 'Part added', data: part });
};

// PATCH /api/admin/parts/:id — details only; stock changes go through /stock
exports.update = async (req, res) => {
  assertObjectId(req.params.id, 'part id');
  const part = await SparePart.findById(req.params.id);
  if (!part) throw ApiError.notFound('Part not found');
  for (const f of ['name', 'unit', 'minQuantity', 'unitCost', 'supplier', 'isActive']) if (req.body[f] !== undefined) part[f] = req.body[f];
  await part.save();
  sendSuccess(res, { message: 'Part updated', data: part });
};

// POST /api/admin/parts/:id/stock — receive stock (in) or correct a count (adjust)
exports.addStock = async (req, res) => {
  assertObjectId(req.params.id, 'part id');
  const { type, quantity, note = '', unitCost } = req.body;
  const delta = type === 'in' ? Math.abs(quantity) : quantity;

  const part = await withTransaction(async (session) => {
    // The filter refuses an adjustment that would take stock below zero.
    const updated = await SparePart.findOneAndUpdate(
      { _id: req.params.id, quantity: { $gte: delta < 0 ? -delta : 0 } },
      { $inc: { quantity: delta }, ...(unitCost != null ? { unitCost } : {}) },
      { returnDocument: 'after', session }
    );
    if (!updated) throw ApiError.badRequest('Part not found or not enough stock for this adjustment');
    await StockMovement.create([{ part: updated._id, type, quantity: delta, unitCost: updated.unitCost, by: req.user._id, note }], { session });
    return updated;
  });
  await audit(req, { action: `part.stock_${type}`, entity: 'SparePart', entityId: part._id, summary: `${delta > 0 ? '+' : ''}${delta} ${part.unit} ${part.name}` });
  sendSuccess(res, { message: 'Stock updated', data: part });
};

// GET /api/admin/parts/:id/movements
exports.movements = async (req, res) => {
  assertObjectId(req.params.id, 'part id');
  const rows = await StockMovement.find({ part: req.params.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('by', 'name')
    .populate('complaint', 'trackingCode')
    .lean();
  sendSuccess(res, { data: rows });
};

// GET /api/complaints/:id/parts — parts used on this complaint
exports.usedOnComplaint = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const rows = await StockMovement.find({ complaint: complaint._id, type: 'out' })
    .sort({ createdAt: 1 })
    .populate('part', 'name sku unit')
    .populate('by', 'name')
    .lean();
  sendSuccess(res, { data: { items: rows, total: complaint.cost?.parts || 0 } });
};

// POST /api/complaints/:id/parts — the assigned staff member records parts used
exports.useOnComplaint = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (!(req.user.role === 'admin' || isAssignedStaff(req.user, complaint))) {
    throw ApiError.forbidden('Only the assigned staff member can record parts');
  }
  if (!['assigned', 'in_progress'].includes(complaint.status)) throw ApiError.badRequest('Parts can only be recorded while the work is open');
  assertObjectId(req.body.part, 'part');
  const qty = req.body.quantity;

  const part = await withTransaction(async (session) => {
    // Atomic: stock is only taken if enough is left.
    const updated = await SparePart.findOneAndUpdate(
      { _id: req.body.part, isActive: true, quantity: { $gte: qty } },
      { $inc: { quantity: -qty } },
      { returnDocument: 'after', session }
    );
    if (!updated) throw ApiError.badRequest('Not enough stock for this part');
    const cost = qty * updated.unitCost;
    await StockMovement.create([{ part: updated._id, type: 'out', quantity: -qty, unitCost: updated.unitCost, complaint: complaint._id, by: req.user._id }], { session });
    await Complaint.updateOne({ _id: complaint._id }, { $inc: { 'cost.parts': cost } }, { session });
    await ComplaintStatusHistory.create(
      [{ complaint: complaint._id, changedBy: req.user._id, type: 'note', oldStatus: complaint.status, newStatus: complaint.status, note: `Used ${qty} ${updated.unit} × ${updated.name} (৳${cost.toLocaleString('en-US')})`, internal: true }],
      { session }
    );
    return updated;
  });

  if (part.quantity <= part.minQuantity) {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    await notify(admins.map((a) => a._id), { title: `Low stock: ${part.name}`, message: `Only ${part.quantity} ${part.unit} left (minimum ${part.minQuantity}).` });
  }
  realtime.toComplaint(complaint._id, 'complaint:updated', { id: String(complaint._id), status: complaint.status });
  sendSuccess(res, { status: 201, message: `Recorded ${qty} ${part.unit} of ${part.name}`, data: { remaining: part.quantity } });
};
