const { SlaPolicy } = require('../models');
const { PRIORITIES } = require('./constants');

const HOUR = 36e5;

// Used when no policy is stored for a priority: [response hours, resolution hours].
const DEFAULT_TARGETS = Object.freeze({
  critical: [1, 8],
  high: [4, 24],
  medium: [24, 72],
  low: [48, 168],
});

/** Targets for a priority: a category-specific policy wins over the general one. */
async function getTargets(priority, categoryId = null) {
  const policies = await SlaPolicy.find({ priority, category: { $in: [categoryId, null] } }).lean();
  const policy = policies.find((p) => p.category && String(p.category) === String(categoryId)) || policies.find((p) => !p.category);
  if (policy) return { responseHours: policy.responseHours, resolveHours: policy.resolveHours };
  const [responseHours, resolveHours] = DEFAULT_TARGETS[priority] || DEFAULT_TARGETS.medium;
  return { responseHours, resolveHours };
}

/** Due dates measured from when the complaint was created. */
async function computeDueDates(createdAt, priority, categoryId) {
  const t = await getTargets(priority, categoryId);
  const start = new Date(createdAt).getTime();
  return {
    responseDueAt: new Date(start + t.responseHours * HOUR),
    resolveDueAt: new Date(start + t.resolveHours * HOUR),
  };
}

/**
 * Fields to $set when a complaint's priority or category changes: new deadlines,
 * and escalation starts over if the new deadline is still ahead.
 */
async function slaUpdateFor(complaint, { priority = complaint.priority, category = complaint.category } = {}) {
  const due = await computeDueDates(complaint.createdAt, priority, category?._id || category);
  const now = Date.now();
  return {
    'sla.responseDueAt': due.responseDueAt,
    'sla.resolveDueAt': due.resolveDueAt,
    'sla.resolveBreached': due.resolveDueAt.getTime() < now,
    'sla.escalationLevel': due.resolveDueAt.getTime() < now ? complaint.sla?.escalationLevel || 0 : 0,
  };
}

const nextPriority = (p) => PRIORITIES[Math.min(PRIORITIES.indexOf(p) + 1, PRIORITIES.length - 1)];

module.exports = { DEFAULT_TARGETS, getTargets, computeDueDates, slaUpdateFor, nextPriority, HOUR };
