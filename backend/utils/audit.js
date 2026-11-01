const { AuditLog } = require('../models');

/**
 * Records an administrative action. Auditing must never break the action itself,
 * so failures are only logged.
 */
async function audit(req, { action, entity, entityId, summary = '', details = {} }) {
  try {
    await AuditLog.create({ actor: req.user?._id, action, entity, entityId, summary, details, ip: req.ip || '' });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = audit;
