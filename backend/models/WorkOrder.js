const mongoose = require('mongoose');

/**
 * Costed repair job attached to a complaint. Above the approval limits it needs
 * sign-off: first the department head, then (for large amounts) the administrator.
 */
const workOrderSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    department: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    estimatedCost: { type: Number, required: true, min: 0 },
    // Approval chain decided at creation, e.g. ['dept_head', 'admin'].
    requiredApprovals: [{ type: String, enum: ['dept_head', 'admin'] }],
    approvals: [
      {
        role: { type: String, enum: ['dept_head', 'admin'] },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        decision: { type: String, enum: ['approved', 'rejected'] },
        note: { type: String, trim: true, maxlength: 500, default: '' },
        at: { type: Date, default: Date.now },
      },
    ],
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' },
  },
  { timestamps: true }
);

workOrderSchema.index({ status: 1, department: 1 });
workOrderSchema.index({ complaint: 1 });

// The role whose decision is needed next, or null when nothing is pending.
workOrderSchema.methods.nextApprover = function nextApprover() {
  if (this.status !== 'pending') return null;
  return this.requiredApprovals[this.approvals.length] || null;
};

workOrderSchema.plugin(require('./tenantPlugin'));
module.exports = mongoose.model('WorkOrder', workOrderSchema);
