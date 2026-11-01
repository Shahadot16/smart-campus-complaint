const mongoose = require('mongoose');
const { PRIORITIES, STATUSES } = require('../utils/constants');

const complaintSchema = new mongoose.Schema(
  {
    trackingCode: { type: String, required: true, unique: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    location: {
      building: { type: String, required: true, trim: true, maxlength: 80 },
      room: { type: String, trim: true, maxlength: 40, default: '' },
    },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: STATUSES, default: 'submitted' },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, trim: true, maxlength: 2000, default: '' },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
    resolvedAt: Date,
    closedAt: Date,
    reopenRequest: {
      requested: { type: Boolean, default: false },
      reason: { type: String, trim: true, maxlength: 1000, default: '' },
      requestedAt: Date,
    },
  },
  { timestamps: true }
);

complaintSchema.index({ student: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ assignedStaff: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
