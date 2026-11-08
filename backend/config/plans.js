/**
 * Subscription plans a university (tenant) can be on. Prices are per month in BDT.
 * The super admin bills tenants for these; tenant admins upgrade/downgrade from
 * their Billing page.
 */
const PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    price: 0,
    tagline: 'Get started, no cost',
    maxUsers: 10,
    maxComplaintsPerMonth: 15,
    features: ['Core complaint workflow', 'Up to 10 users', '15 complaints / month', 'Email notifications', 'Community issue board'],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    price: 4999,
    tagline: 'For a busy campus',
    maxUsers: 250,
    maxComplaintsPerMonth: 2000,
    features: ['Everything in Free', 'Up to 250 users', 'Analytics dashboard', 'SLA & auto-escalation', 'AI assistant', 'Excel export'],
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    price: 9999,
    tagline: 'For large institutions',
    maxUsers: 100000,
    maxComplaintsPerMonth: 100000,
    features: ['Everything in Pro', 'Unlimited users & complaints', 'Priority support', 'Custom white-label branding', 'Dedicated onboarding'],
  },
}

const PLAN_ORDER = ['free', 'pro', 'premium']

function getPlan(key) {
  return PLANS[key] || PLANS.free
}

module.exports = { PLANS, PLAN_ORDER, getPlan }
