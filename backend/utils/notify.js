const { Notification } = require('../models');

/**
 * Creates in-app notifications. Notifications are non-critical, so failures
 * are logged and never break the main request.
 */
async function notify(userIds, { title, message, complaint }) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  if (!unique.length) return;
  try {
    await Notification.insertMany(
      unique.map((user) => ({ user, title, message, complaint: complaint?._id || complaint }))
    );
  } catch (err) {
    console.error('Failed to create notifications:', err.message);
  }
}

module.exports = notify;
