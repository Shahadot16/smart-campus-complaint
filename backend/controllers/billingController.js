const { Tenant, Invoice, Complaint, User, Counter } = require('../models');
const { PLANS, PLAN_ORDER, getPlan } = require('../config/plans');
const { getTenantId } = require('../utils/tenantContext');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');

const MONTH = 30 * 24 * 60 * 60 * 1000;

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function nextInvoiceNumber() {
  const seq = await Counter.next(`invoice-${getTenantId()}`);
  return `INV-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
}

// GET /api/billing/plans — all plans
exports.plans = async (_req, res) => {
  sendSuccess(res, { data: { plans: PLAN_ORDER.map((k) => PLANS[k]) } });
};

// GET /api/billing/subscription — current plan, subscription status and usage
exports.subscription = async (req, res) => {
  const t = await Tenant.findById(req.tenant._id).lean();
  const plan = getPlan(t.plan);
  const [complaintsThisMonth, users, lastPaid] = await Promise.all([
    Complaint.countDocuments({ createdAt: { $gte: startOfMonth() } }),
    User.countDocuments({ role: { $ne: 'super_admin' } }),
    Invoice.findOne({ status: 'paid' }).sort({ paidAt: -1 }).lean(),
  ]);
  sendSuccess(res, {
    data: {
      plan,
      subscription: t.subscription || { status: 'active' },
      usage: {
        users,
        maxUsers: plan.maxUsers,
        complaintsThisMonth,
        maxComplaintsPerMonth: plan.maxComplaintsPerMonth,
      },
      lastPaidAt: lastPaid?.paidAt || null,
      allPlans: PLAN_ORDER.map((k) => PLANS[k]),
    },
  });
};

// POST /api/billing/subscribe — change plan (creates an invoice for paid plans)
exports.subscribe = async (req, res) => {
  const key = String(req.body.plan || '').toLowerCase();
  if (!PLANS[key]) throw ApiError.badRequest('Unknown plan');
  const plan = PLANS[key];
  const t = await Tenant.findById(req.tenant._id);

  t.plan = key;

  // Free plan activates immediately with no charge.
  if (plan.price === 0) {
    t.subscription = { status: 'active', currentPeriodEnd: null };
    await t.save();
    return sendSuccess(res, { message: `Switched to the ${plan.name} plan`, data: { invoice: null, plan } });
  }

  // Paid plan: raise a pending invoice; the subscription is past_due until paid.
  const now = new Date();
  const invoice = await Invoice.create({
    number: await nextInvoiceNumber(),
    plan: key,
    planName: plan.name,
    amount: plan.price,
    period: { start: now, end: new Date(now.getTime() + MONTH) },
    status: 'pending',
    createdBy: req.user._id,
  });
  t.subscription = { status: 'past_due', currentPeriodEnd: t.subscription?.currentPeriodEnd };
  await t.save();

  sendSuccess(res, { status: 201, message: `Invoice raised for the ${plan.name} plan`, data: { invoice, plan } });
};

// GET /api/billing/invoices — this university's invoices
exports.invoices = async (_req, res) => {
  const invoices = await Invoice.find().sort({ createdAt: -1 }).lean();
  sendSuccess(res, { data: invoices });
};

// GET /api/billing/invoices/:id — one invoice (for the printable receipt)
exports.invoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).lean();
  if (!invoice) throw ApiError.notFound('Invoice not found');
  const t = await Tenant.findById(req.tenant._id).lean();
  sendSuccess(res, { data: { invoice, tenant: { name: t.name, shortName: t.shortName, address: t.address, emailDomain: t.emailDomain, branding: t.branding } } });
};

// POST /api/billing/invoices/:id/pay — simulated payment (demo gateway)
exports.payInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status === 'paid') throw ApiError.badRequest('This invoice is already paid');

  invoice.status = 'paid';
  invoice.paidAt = new Date();
  invoice.method = String(req.body.method || 'card');
  await invoice.save();

  // Activate the subscription for one month.
  const t = await Tenant.findById(req.tenant._id);
  t.plan = invoice.plan;
  t.subscription = { status: 'active', currentPeriodEnd: invoice.period.end };
  await t.save();

  sendSuccess(res, { message: 'Payment successful', data: { invoice } });
};
