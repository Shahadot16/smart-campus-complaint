/**
 * Enforces the subscription plan's quotas for the current tenant. Counts are
 * made inside the request's tenant context, so they are automatically scoped
 * to the tenant. Super-admin / unscoped requests have no plan and are skipped.
 */
const { Tenant, Complaint, User } = require('../models');
const { getPlan } = require('../config/plans');
const { getTenantId } = require('./tenantContext');
const ApiError = require('./ApiError');

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** The current tenant's plan, or null when the request is not tenant-scoped. */
async function currentPlan() {
  const tid = getTenantId();
  if (!tid) return null;
  const t = await Tenant.findById(tid).select('plan').lean();
  return t ? getPlan(t.plan) : getPlan('free');
}

/** Usage counts + limits for the current tenant (used by the UI and guards). */
async function usage() {
  const plan = await currentPlan();
  if (!plan) return null;
  const [complaintsThisMonth, users] = await Promise.all([
    Complaint.countDocuments({ createdAt: { $gte: startOfMonth() } }),
    User.countDocuments({ role: { $ne: 'super_admin' } }),
  ]);
  return {
    plan,
    complaintsThisMonth,
    maxComplaintsPerMonth: plan.maxComplaintsPerMonth,
    users,
    maxUsers: plan.maxUsers,
  };
}

/** Block a new complaint when the tenant is at its monthly cap. */
async function assertComplaintQuota() {
  const plan = await currentPlan();
  if (!plan) return;
  const used = await Complaint.countDocuments({ createdAt: { $gte: startOfMonth() } });
  if (used >= plan.maxComplaintsPerMonth) {
    throw ApiError.paymentRequired(
      `This month's complaint limit for the ${plan.name} plan (${plan.maxComplaintsPerMonth}) has been reached. Please ask an administrator to upgrade the plan to file more complaints.`
    );
  }
}

/** Block a new user account when the tenant is at its user cap. */
async function assertUserQuota() {
  const plan = await currentPlan();
  if (!plan) return;
  const used = await User.countDocuments({ role: { $ne: 'super_admin' } });
  if (used >= plan.maxUsers) {
    throw ApiError.paymentRequired(
      `The ${plan.name} plan allows ${plan.maxUsers} user accounts and that limit has been reached. Upgrade the plan to add more people.`
    );
  }
}

module.exports = { currentPlan, usage, assertComplaintQuota, assertUserQuota };
