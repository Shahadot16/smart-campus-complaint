const { Asset, Complaint, Location } = require('../models');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const { sendSuccess, getPagination, buildMeta, escapeRegex } = require('../utils/response');
const { assertObjectId } = require('../utils/access');

const FAILURE_WINDOW_DAYS = 90;
const REPLACE_AFTER_FAILURES = 3;

// GET /api/assets?search=&status=&location=&department=
exports.list = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.department) filter.department = String(req.query.department).toUpperCase();
  if (req.user.role === 'dept_head') filter.department = req.user.department;
  if (req.query.location) {
    assertObjectId(req.query.location, 'location');
    const inside = await Location.find({ $or: [{ _id: req.query.location }, { building: req.query.location }, { parent: req.query.location }] }).select('_id');
    filter.location = { $in: inside.map((l) => l._id) };
  }
  if (req.query.search?.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    filter.$or = [{ name: rx }, { code: rx }, { type: rx }, { serialNo: rx }];
  }

  const since = new Date(Date.now() - FAILURE_WINDOW_DAYS * 864e5);
  const [items, total] = await Promise.all([
    Asset.find(filter).sort({ code: 1 }).skip(skip).limit(limit).populate('location', 'name type').populate('category', 'name').lean(),
    Asset.countDocuments(filter),
  ]);
  const failures = await Complaint.aggregate([
    { $match: { asset: { $in: items.map((a) => a._id) }, createdAt: { $gte: since } } },
    { $group: { _id: '$asset', n: { $sum: 1 } } },
  ]);
  const byId = Object.fromEntries(failures.map((f) => [String(f._id), f.n]));
  sendSuccess(res, {
    data: items.map((a) => ({ ...a, recentFailures: byId[String(a._id)] || 0, replaceSuggested: (byId[String(a._id)] || 0) >= REPLACE_AFTER_FAILURES })),
    meta: buildMeta(page, limit, total),
  });
};

async function withHistory(asset) {
  const complaints = await Complaint.find({ asset: asset._id })
    .sort({ createdAt: -1 })
    .select('trackingCode title status priority createdAt resolvedAt cost assignedStaff')
    .populate('assignedStaff', 'name')
    .lean();
  const since = Date.now() - FAILURE_WINDOW_DAYS * 864e5;
  const recentFailures = complaints.filter((c) => new Date(c.createdAt).getTime() >= since).length;
  const underWarranty = asset.warrantyUntil ? new Date(asset.warrantyUntil) > new Date() : false;
  return {
    ...asset,
    history: complaints,
    stats: {
      totalRepairs: complaints.length,
      recentFailures,
      partsCost: complaints.reduce((n, c) => n + (c.cost?.parts || 0), 0),
      underWarranty,
    },
    replaceSuggested: recentFailures >= REPLACE_AFTER_FAILURES,
    advice:
      recentFailures >= REPLACE_AFTER_FAILURES
        ? `Failed ${recentFailures} times in ${FAILURE_WINDOW_DAYS} days — consider replacing it${underWarranty ? ' under warranty' : ''}.`
        : null,
  };
}

// GET /api/assets/:id — details with full repair history
exports.get = async (req, res) => {
  assertObjectId(req.params.id, 'asset id');
  const asset = await Asset.findById(req.params.id).populate('location', 'name type building').populate('category', 'name').lean();
  if (!asset) throw ApiError.notFound('Asset not found');
  if (req.user.role === 'dept_head' && asset.department !== req.user.department) throw ApiError.forbidden('This asset belongs to another department');
  sendSuccess(res, { data: await withHistory(asset) });
};

// GET /api/assets/code/:code — QR lookup (any signed-in user, minimal data)
exports.byCode = async (req, res) => {
  const asset = await Asset.findOne({ code: String(req.params.code).toUpperCase(), status: { $ne: 'retired' } })
    .select('code name type location category')
    .populate({ path: 'location', select: 'name type building parent', populate: [{ path: 'building', select: 'name' }, { path: 'parent', select: 'name type' }] })
    .lean();
  if (!asset) throw ApiError.notFound('Unknown asset code');
  sendSuccess(res, { data: asset });
};

const FIELDS = ['name', 'type', 'category', 'location', 'department', 'serialNo', 'purchaseDate', 'warrantyUntil', 'status', 'notes'];

// POST /api/admin/assets
exports.create = async (req, res) => {
  if (await Asset.exists({ code: req.body.code.toUpperCase() })) throw ApiError.conflict('An asset with this code already exists');
  const data = { code: req.body.code };
  for (const f of FIELDS) if (req.body[f] !== undefined && req.body[f] !== '') data[f] = req.body[f];
  if (data.location && !data.department) data.department = (await Location.findById(data.location).select('department').lean())?.department || '';
  const asset = await Asset.create(data);
  await audit(req, { action: 'asset.create', entity: 'Asset', entityId: asset._id, summary: `Added asset ${asset.code} (${asset.name})` });
  sendSuccess(res, { status: 201, message: 'Asset added', data: asset });
};

// PATCH /api/admin/assets/:id
exports.update = async (req, res) => {
  assertObjectId(req.params.id, 'asset id');
  const asset = await Asset.findById(req.params.id);
  if (!asset) throw ApiError.notFound('Asset not found');
  for (const f of FIELDS) if (req.body[f] !== undefined) asset[f] = req.body[f] === '' ? null : req.body[f];
  await asset.save();
  await audit(req, { action: 'asset.update', entity: 'Asset', entityId: asset._id, summary: `Updated asset ${asset.code}`, details: req.body });
  sendSuccess(res, { message: 'Asset updated', data: asset });
};
