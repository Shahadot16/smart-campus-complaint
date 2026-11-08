const mongoose = require('mongoose');

// Who did what, to which record, and when. Written for every administrative action.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, maxlength: 60 },
    entity: { type: String, required: true, maxlength: 40 },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, maxlength: 300, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, maxlength: 64, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

auditLogSchema.plugin(require('./tenantPlugin'));
module.exports = mongoose.model('AuditLog', auditLogSchema);
