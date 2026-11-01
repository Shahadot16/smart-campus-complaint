const { User, Complaint, Feedback, Location } = require('../models');

const OPEN = ['assigned', 'in_progress'];

/**
 * Ranks active staff for a complaint. Score (0–100) =
 *   skill match 40 + zone match 20 + free capacity 25 + rating 10 + SLA record 5.
 * Staff on leave or already at their task limit are listed but marked unavailable.
 */
async function rankStaff(complaint, now = new Date()) {
  const staff = await User.find({ role: 'staff', isActive: true }).lean();
  if (!staff.length) return [];
  const ids = staff.map((s) => s._id);

  const [open, ratings, sla, place] = await Promise.all([
    Complaint.aggregate([
      { $match: { assignedStaff: { $in: ids }, status: { $in: OPEN } } },
      { $group: { _id: '$assignedStaff', n: { $sum: 1 } } },
    ]),
    Feedback.aggregate([
      { $lookup: { from: 'complaints', localField: 'complaint', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $match: { 'c.assignedStaff': { $in: ids } } },
      { $group: { _id: '$c.assignedStaff', avg: { $avg: '$rating' } } },
    ]),
    Complaint.aggregate([
      { $match: { assignedStaff: { $in: ids }, resolvedAt: { $ne: null } } },
      { $group: { _id: '$assignedStaff', total: { $sum: 1 }, breached: { $sum: { $cond: ['$sla.resolveBreached', 1, 0] } } } },
    ]),
    complaint.location?.place ? Location.findById(complaint.location.place).select('type building').lean() : null,
  ]);

  const map = (rows, f) => Object.fromEntries(rows.map((r) => [String(r._id), f(r)]));
  const openBy = map(open, (r) => r.n);
  const ratingBy = map(ratings, (r) => r.avg);
  const slaBy = map(sla, (r) => (r.total ? (r.total - r.breached) / r.total : null));
  const buildingId = place ? String(place.type === 'building' ? place._id : place.building) : null;
  const categoryId = String(complaint.category?._id || complaint.category);

  return staff
    .map((s) => {
      const id = String(s._id);
      const profile = s.staffProfile || {};
      const skills = (profile.skills || []).map(String);
      const zones = (profile.zones || []).map(String);
      const max = profile.maxOpenTasks || 6;
      const openTasks = openBy[id] || 0;
      const onLeave = (profile.leaves || []).some((l) => l.from <= now && now <= l.to);

      const parts = {
        skill: skills.length ? (skills.includes(categoryId) ? 40 : 0) : 15, // no profile yet: neutral
        zone: zones.length && buildingId ? (zones.includes(buildingId) ? 20 : 0) : 8,
        capacity: Math.round(Math.max(0, 1 - openTasks / max) * 25),
        rating: ratingBy[id] != null ? Math.round(((ratingBy[id] - 1) / 4) * 10) : 5,
        sla: slaBy[id] != null ? Math.round(slaBy[id] * 5) : 3,
      };
      const reasons = [];
      if (parts.skill === 40) reasons.push('Skilled in this category');
      if (parts.zone === 20) reasons.push('Covers this building');
      if (openTasks === 0) reasons.push('No open tasks');
      if (ratingBy[id] >= 4.5) reasons.push('Highly rated');

      const available = !onLeave && openTasks < max;
      return {
        id: s._id,
        name: s.name,
        department: s.department,
        openTasks,
        maxOpenTasks: max,
        onLeave,
        available,
        score: available ? Object.values(parts).reduce((a, b) => a + b, 0) : 0,
        breakdown: parts,
        reasons: available ? reasons : [onLeave ? 'On leave' : 'At task limit'],
      };
    })
    .sort((a, b) => Number(b.available) - Number(a.available) || b.score - a.score);
}

/** Best available staff member for a complaint, or null. */
async function bestStaff(complaint) {
  const [top] = await rankStaff(complaint);
  return top?.available ? top : null;
}

module.exports = { rankStaff, bestStaff };
