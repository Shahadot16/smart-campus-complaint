const { Complaint, ComplaintStatusHistory, User } = require('../models');
const notify = require('../utils/notify');
const realtime = require('../utils/realtime');
const { nextPriority } = require('../utils/sla');

const OPEN = ['submitted', 'under_review', 'needs_information', 'assigned', 'in_progress'];
const WARN_AT = 0.8; // "due soon" warning when 80% of the resolution window has passed

/**
 * Escalation ladder for open complaints (checked every minute):
 *   level 1  80% of the time used      -> warn the assigned staff member
 *   level 2  resolution deadline missed -> mark breached, alert staff + admins
 *   level 3  50% past the deadline      -> raise priority one step
 *   level 4  100% past the deadline     -> final escalation to all admins
 * A missed *response* deadline (nobody acted on a new complaint) alerts admins once.
 */
async function checkSla(now = new Date()) {
  const admins = (await User.find({ role: 'admin', isActive: true }).select('_id').lean()).map((a) => a._id);
  const summary = { responseBreaches: 0, warnings: 0, breaches: 0, raised: 0, final: 0 };

  // 1) Response deadline: still untouched after responseDueAt.
  const unanswered = await Complaint.find({
    status: 'submitted',
    'sla.firstResponseAt': null,
    'sla.responseBreached': false,
    'sla.responseDueAt': { $lte: now },
  });
  for (const c of unanswered) {
    c.sla.responseBreached = true;
    await c.save({ timestamps: false });
    await record(c, `Response deadline missed — no action within the ${c.priority} priority target.`);
    await notify(admins, { email: 'slaAlerts', title: `SLA: ${c.trackingCode} needs a response`, message: `"${c.title}" has had no action since it was submitted.`, complaint: c });
    summary.responseBreaches += 1;
  }

  // 2) Resolution ladder.
  const open = await Complaint.find({ status: { $in: OPEN }, 'sla.resolveDueAt': { $ne: null }, 'sla.escalationLevel': { $lt: 4 } });
  for (const c of open) {
    const start = c.createdAt.getTime();
    const due = c.sla.resolveDueAt.getTime();
    const window = Math.max(due - start, 60000);
    const elapsed = (now.getTime() - start) / window; // 1.0 = deadline
    const level = elapsed >= 2 ? 4 : elapsed >= 1.5 ? 3 : elapsed >= 1 ? 2 : elapsed >= WARN_AT ? 1 : 0;
    if (level <= c.sla.escalationLevel) continue;

    const staff = c.assignedStaff ? [c.assignedStaff] : [];
    if (level === 1) {
      await notify(staff.length ? staff : admins, {
        email: 'slaAlerts',
        title: `Due soon: ${c.trackingCode}`,
        message: `"${c.title}" must be resolved by ${c.sla.resolveDueAt.toLocaleString('en-GB')}.`,
        complaint: c,
      });
      summary.warnings += 1;
    }
    if (level >= 2 && c.sla.escalationLevel < 2) {
      c.sla.resolveBreached = true;
      await record(c, 'Resolution deadline missed — escalated to administrators.');
      await notify([...staff, ...admins], { email: 'slaAlerts', title: `SLA breached: ${c.trackingCode}`, message: `"${c.title}" is past its resolution deadline.`, complaint: c });
      summary.breaches += 1;
    }
    if (level >= 3 && c.sla.escalationLevel < 3 && c.priority !== 'critical') {
      const from = c.priority;
      c.priority = nextPriority(from);
      await record(c, `Priority raised automatically from ${from} to ${c.priority} (overdue).`, 'priority');
      await notify([...staff, ...admins], { email: 'slaAlerts', title: `Priority raised: ${c.trackingCode}`, message: `Overdue complaint raised from ${from} to ${c.priority}.`, complaint: c });
      summary.raised += 1;
    }
    if (level >= 4 && c.sla.escalationLevel < 4) {
      await record(c, 'Final escalation — complaint is twice past its deadline.');
      await notify(admins, { email: 'slaAlerts', title: `URGENT: ${c.trackingCode} badly overdue`, message: `"${c.title}" is far past its deadline and still open.`, complaint: c });
      summary.final += 1;
    }

    c.sla.escalationLevel = level;
    c.sla.lastEscalatedAt = now;
    await c.save({ timestamps: false });
    realtime.toComplaint(c._id, 'complaint:updated', { id: String(c._id), status: c.status });
  }
  return summary;
}

function record(c, note, type = 'sla') {
  return ComplaintStatusHistory.create({
    complaint: c._id,
    changedBy: null, // automatic event
    type,
    oldStatus: c.status,
    newStatus: c.status,
    note,
    internal: false,
  });
}

module.exports = { checkSla };
