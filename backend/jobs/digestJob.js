const config = require('../config/env');
const university = require('../config/university');
const { Complaint, JobRun, User } = require('../models');
const { sendMail, button } = require('../utils/mailer');

const SEND_HOUR = 8; // local server time

const dayKey = (d) => d.toISOString().slice(0, 10);

/**
 * Morning summary email for administrators: new, open, overdue and resolved
 * complaints in the last 24 hours. Sent at most once per day.
 */
async function sendDailyDigest(now = new Date(), { force = false } = {}) {
  const previous = (await JobRun.findById('daily-digest').lean())?.lastResult;
  if (!force && (now.getHours() < SEND_HOUR || previous?.sentOn === dayKey(now))) return previous || null;

  const since = new Date(now.getTime() - 24 * 36e5);
  const open = ['submitted', 'under_review', 'needs_information', 'assigned', 'in_progress'];
  const [created, resolved, openCount, overdue] = await Promise.all([
    Complaint.countDocuments({ createdAt: { $gte: since } }),
    Complaint.countDocuments({ resolvedAt: { $gte: since } }),
    Complaint.countDocuments({ status: { $in: open } }),
    Complaint.find({ status: { $in: open }, 'sla.resolveDueAt': { $lt: now } })
      .sort({ 'sla.resolveDueAt': 1 })
      .limit(10)
      .select('trackingCode title priority sla.resolveDueAt')
      .lean(),
  ]);

  const admins = await User.find({ role: 'admin', isActive: true, 'emailPrefs.dailyDigest': { $ne: false } }).select('email name').lean();
  const rows = overdue
    .map((c) => `<tr><td style="padding:4px 8px;font-family:monospace">${c.trackingCode}</td><td style="padding:4px 8px">${c.title}</td><td style="padding:4px 8px">${c.priority}</td></tr>`)
    .join('');
  const html = `
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px"><tr>
      ${[['New (24h)', created], ['Resolved (24h)', resolved], ['Open now', openCount], ['Overdue', overdue.length]]
        .map(([l, v]) => `<td style="padding:10px;border:1px solid #dce8e0;text-align:center"><div style="font-size:22px;font-weight:700;color:#0a4029">${v}</div><div style="font-size:12px;color:#4d6156">${l}</div></td>`)
        .join('')}
    </tr></table>
    ${overdue.length ? `<p><strong>Most overdue:</strong></p><table style="font-size:13px;border-collapse:collapse">${rows}</table>` : '<p>No overdue complaints. 🎉</p>'}
    ${button(`${config.appUrl}/admin/complaints`, 'Open the dashboard')}`;

  await Promise.all(
    admins.map((a) =>
      sendMail({
        to: a.email,
        subject: `${university.shortName} Smart Campus — daily summary`,
        title: 'Your daily complaint summary',
        html,
        text: `New: ${created}, resolved: ${resolved}, open: ${openCount}, overdue: ${overdue.length}`,
      })
    )
  );
  return { sentOn: dayKey(now), recipients: admins.length, created, resolved, open: openCount, overdue: overdue.length };
}

module.exports = { sendDailyDigest };
