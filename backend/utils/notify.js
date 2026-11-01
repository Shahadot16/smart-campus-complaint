const config = require('../config/env');
const { Notification, User } = require('../models');
const realtime = require('./realtime');
const { sendMail, button } = require('./mailer');

/**
 * Creates in-app notifications, pushes them live and — when `email` names a
 * preference (statusUpdates, assignments, slaAlerts, chatMessages) — also emails
 * recipients who opted in. Notifications are non-critical, so failures are
 * logged and never break the main request.
 */
async function notify(userIds, { title, message, complaint, email }) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  if (!unique.length) return;
  try {
    const docs = await Notification.insertMany(
      unique.map((user) => ({ user, title, message, complaint: complaint?._id || complaint }))
    );
    // Push each notification live to its recipient.
    for (const doc of docs) realtime.toUsers([doc.user], 'notification:new', doc.toObject());

    if (email) await emailRecipients(unique, email, { title, message, complaint });
  } catch (err) {
    console.error('Failed to create notifications:', err.message);
  }
}

async function emailRecipients(userIds, pref, { title, message, complaint }) {
  const users = await User.find({ _id: { $in: userIds }, isActive: true, [`emailPrefs.${pref}`]: { $ne: false } })
    .select('email name')
    .lean();
  const link = complaint ? `${config.appUrl}/complaints/${complaint._id || complaint}` : config.appUrl;
  await Promise.all(
    users.map((u) =>
      sendMail({
        to: u.email,
        subject: title,
        title,
        html: `<p>Hi ${u.name.split(' ')[0]},</p><p>${escapeHtml(message)}</p>${button(link, 'Open in Smart Campus')}`,
        text: `${message}\n\n${link}`,
      })
    )
  );
}

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = notify;
