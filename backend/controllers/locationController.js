const { Location, Complaint } = require('../models');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const { sendSuccess } = require('../utils/response');
const { buildTree } = require('../utils/locations');
const { assertObjectId } = require('../utils/access');
const university = require('../config/university');

const FIELDS = 'name type parent building code department geo isActive';

// GET /api/locations — active campus tree (admins may pass ?all=true)
exports.tree = async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.all === 'true' ? {} : { isActive: true };
  const list = await Location.find(filter).select(FIELDS).lean();
  sendSuccess(res, { data: { tree: buildTree(list), center: university.location } });
};

// GET /api/locations/code/:code — resolve a scanned QR code
exports.byCode = async (req, res) => {
  const loc = await Location.findOne({ code: String(req.params.code).toUpperCase(), isActive: true })
    .populate('building', 'name')
    .populate('parent', 'name type')
    .lean();
  if (!loc) throw ApiError.notFound('Unknown location code');
  sendSuccess(res, { data: loc });
};

// GET /api/locations/stats — open/total complaints per building, for the campus map
exports.stats = async (_req, res) => {
  const buildings = await Location.find({ type: 'building', isActive: true }).select('name code geo department').lean();
  const rows = await Complaint.aggregate([
    {
      $group: {
        _id: '$location.building',
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'under_review', 'needs_information', 'assigned', 'in_progress']] }, 1, 0] } },
        critical: { $sum: { $cond: [{ $and: [{ $eq: ['$priority', 'critical'] }, { $not: [{ $in: ['$status', ['resolved', 'closed', 'rejected']] }] }] }, 1, 0] } },
      },
    },
  ]);
  const byName = Object.fromEntries(rows.map((r) => [r._id, r]));
  sendSuccess(res, {
    data: {
      center: university.location,
      buildings: buildings.map((b) => ({ ...b, total: byName[b.name]?.total || 0, open: byName[b.name]?.open || 0, critical: byName[b.name]?.critical || 0 })),
    },
  });
};

async function loadParent(parentId, type) {
  if (type === 'building') return null;
  if (!parentId) throw ApiError.badRequest(`A ${type} needs a parent location`);
  assertObjectId(parentId, 'parent');
  const parent = await Location.findById(parentId);
  if (!parent) throw ApiError.badRequest('Parent location not found');
  const allowed = type === 'floor' ? ['building'] : ['building', 'floor'];
  if (!allowed.includes(parent.type)) throw ApiError.badRequest(`A ${type} cannot be placed inside a ${parent.type}`);
  return parent;
}

// POST /api/admin/locations
exports.create = async (req, res) => {
  const { name, type, code, department = '', lat, lng } = req.body;
  const parent = await loadParent(req.body.parent, type);
  if (await Location.exists({ code: code.toUpperCase() })) throw ApiError.conflict('This code is already used by another location');
  const loc = await Location.create({
    name,
    type,
    code,
    department,
    parent: parent?._id || null,
    building: parent ? parent.building || parent._id : null,
    geo: type === 'building' && lat != null && lng != null ? { lat, lng } : undefined,
  });
  await audit(req, { action: 'location.create', entity: 'Location', entityId: loc._id, summary: `Created ${type} ${name} (${loc.code})` });
  sendSuccess(res, { status: 201, message: 'Location created', data: loc });
};

// PATCH /api/admin/locations/:id
exports.update = async (req, res) => {
  assertObjectId(req.params.id, 'location id');
  const loc = await Location.findById(req.params.id);
  if (!loc) throw ApiError.notFound('Location not found');
  if (req.body.code && req.body.code.toUpperCase() !== loc.code && (await Location.exists({ code: req.body.code.toUpperCase() }))) {
    throw ApiError.conflict('This code is already used by another location');
  }
  for (const f of ['name', 'code', 'department', 'isActive']) if (req.body[f] !== undefined) loc[f] = req.body[f];
  if (loc.type === 'building' && req.body.lat != null && req.body.lng != null) loc.geo = { lat: req.body.lat, lng: req.body.lng };
  await loc.save();
  // Deactivating a building or floor hides everything inside it too.
  if (req.body.isActive === false) await Location.updateMany({ $or: [{ parent: loc._id }, { building: loc._id }] }, { isActive: false });
  await audit(req, { action: 'location.update', entity: 'Location', entityId: loc._id, summary: `Updated ${loc.type} ${loc.name}`, details: req.body });
  sendSuccess(res, { message: 'Location updated', data: loc });
};
