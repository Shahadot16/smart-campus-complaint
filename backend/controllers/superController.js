const { Tenant, User, Complaint, Category, Department, Invoice } = require('../models');
const university = require('../config/university');
const { getPlan } = require('../config/plans');
const { runAsTenant } = require('../utils/tenantContext');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');
const { startSession, profile } = require('./authController');
const { CATEGORIES } = require('../utils/seed');

/** Public view of a tenant (no internal fields the super admin doesn't need). */
function tenantView(t) {
  return {
    id: t._id,
    name: t.name,
    shortName: t.shortName,
    slug: t.slug,
    emailDomain: t.emailDomain,
    website: t.website,
    address: t.address,
    phone: t.phone,
    branding: t.branding,
    plan: t.plan,
    status: t.status,
    createdAt: t.createdAt,
    usage: t.usage,
  };
}

// GET /api/super/public-tenants — public directory of universities (for the login picker)
exports.publicTenants = async (_req, res) => {
  const tenants = await Tenant.find({ status: 'active' }).sort({ name: 1 }).select('name shortName slug branding').lean();
  sendSuccess(res, {
    data: tenants.map((t) => ({ name: t.name, shortName: t.shortName, slug: t.slug, branding: t.branding })),
  });
};

// POST /api/super/login — platform owner sign-in
exports.login = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '').trim();
  const user = await User.findOne({ email, role: 'super_admin' }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated.');
  user.lastLoginAt = new Date();
  await user.save();
  await startSession(req, res, user);
  sendSuccess(res, { message: 'Login successful', data: { user: profile(user) } });
};

// GET /api/super/me
exports.me = async (req, res) => sendSuccess(res, { data: { user: profile(req.user) } });

// GET /api/super/tenants — all universities with live usage counts
exports.listTenants = async (_req, res) => {
  const tenants = await Tenant.find().sort({ createdAt: 1 }).lean();
  const data = await Promise.all(
    tenants.map(async (t) => {
      const [users, complaints] = await Promise.all([
        User.countDocuments({ tenantId: t._id }),
        Complaint.countDocuments({ tenantId: t._id }),
      ]);
      return tenantView({ ...t, usage: { users, complaints } });
    })
  );
  sendSuccess(res, { data });
};

// GET /api/super/stats — platform-wide totals
exports.stats = async (_req, res) => {
  const [tenants, activeTenants, users, complaints] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: 'active' }),
    User.countDocuments({ role: { $ne: 'super_admin' } }),
    Complaint.countDocuments(),
  ]);
  sendSuccess(res, { data: { tenants, activeTenants, users, complaints } });
};

// GET /api/super/billing — platform revenue overview
exports.billing = async (_req, res) => {
  const tenants = await Tenant.find().lean();
  let mrr = 0;
  const planDist = { free: 0, pro: 0, premium: 0 };
  for (const t of tenants) {
    planDist[t.plan] = (planDist[t.plan] || 0) + 1;
    if (t.subscription?.status === 'active') mrr += getPlan(t.plan).price;
  }
  const [paid, pendingInvoices, recent] = await Promise.all([
    Invoice.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Invoice.countDocuments({ status: 'pending' }),
    Invoice.find().sort({ createdAt: -1 }).limit(15).populate('tenantId', 'name shortName branding').lean(),
  ]);
  sendSuccess(res, {
    data: {
      mrr,
      totalRevenue: paid[0]?.total || 0,
      paidInvoices: paid[0]?.count || 0,
      pendingInvoices,
      planDist,
      recent: recent.map((i) => ({ ...i, tenant: i.tenantId })),
    },
  });
};

// POST /api/super/tenants — onboard a new university
exports.createTenant = async (req, res) => {
  const b = req.body || {};
  const slug = String(b.slug || '').toLowerCase().trim();
  if (!b.name || !b.shortName || !slug || !b.adminEmail || !b.adminPassword) {
    throw ApiError.badRequest('Name, short name, slug, admin email and admin password are required.');
  }
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw ApiError.badRequest('Slug may contain only lowercase letters, numbers and hyphens.');
  if (String(b.adminPassword).length < 8) throw ApiError.badRequest('Admin password must be at least 8 characters.');
  if (await Tenant.findOne({ slug })) throw ApiError.conflict('That slug is already taken. Please choose another.');

  const tenant = await Tenant.create({
    name: b.name,
    shortName: b.shortName,
    slug,
    emailDomain: String(b.emailDomain || '').toLowerCase().trim(),
    website: b.website || '',
    address: b.address || '',
    phone: b.phone || '',
    branding: {
      logo: '',
      logoWide: '',
      primaryColor: b.primaryColor || '#0a4029',
      accentColor: b.accentColor || '#16a34a',
      tagline: b.tagline || 'Complaint & maintenance portal',
    },
    createdBy: req.user._id,
  });

  // Provision default content for the new tenant (departments, categories, first admin).
  await runAsTenant(tenant._id, async () => {
    await Department.insertMany(university.departments.map((d) => ({ code: d.code, name: d.name, programs: d.programs, url: d.url })));
    await Category.insertMany(CATEGORIES.map(([name, description]) => ({ name, description })));
    const admin = new User({
      name: b.adminName || `${b.shortName} Administrator`,
      email: String(b.adminEmail).toLowerCase().trim(),
      role: 'admin',
      department: 'Facilities Office',
      emailVerified: true,
    });
    await admin.setPassword(b.adminPassword);
    await admin.save();
  });

  sendSuccess(res, { status: 201, message: `${tenant.name} created successfully.`, data: { tenant: tenantView(tenant.toObject()) } });
};

// PATCH /api/super/tenants/:id — suspend/activate or edit branding
exports.updateTenant = async (req, res) => {
  const t = await Tenant.findById(req.params.id);
  if (!t) throw ApiError.notFound('University not found');
  const b = req.body || {};
  if (b.status && ['active', 'suspended'].includes(b.status)) t.status = b.status;
  if (b.plan && ['free', 'pro', 'premium'].includes(b.plan)) t.plan = b.plan;
  if (typeof b.name === 'string' && b.name.trim()) t.name = b.name.trim();
  if (typeof b.tagline === 'string') t.branding.tagline = b.tagline;
  if (typeof b.primaryColor === 'string') t.branding.primaryColor = b.primaryColor;
  if (typeof b.accentColor === 'string') t.branding.accentColor = b.accentColor;
  await t.save();
  sendSuccess(res, { message: 'University updated', data: { tenant: tenantView(t.toObject()) } });
};
