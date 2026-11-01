const mongoose = require('mongoose');
const { STATUSES } = require('../utils/constants');

// Append-only audit log for a complaint. `type` distinguishes status changes
// from assignment, priority and note events; internal entries are hidden from students.
const historySchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['status', 'assignment', 'priority', 'note'], default: 'status' },
    oldStatus: { type: String, enum: [...STATUSES, null], default: null },
    newStatus: { type: String, enum: STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: '' },
    internal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

historySchema.index({ complaint: 1, createdAt: 1 });

module.exports = mongoose.model('ComplaintStatusHistory', historySchema, 'complaintStatusHistory');
