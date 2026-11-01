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
      // The building/room chosen from the campus location tree (or scanned from a QR code).
      place: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    // Engineering department responsible (from the location, else the student's department).
    department: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    // Running repair cost of spare parts used (BDT).
    cost: {
      parts: { type: Number, default: 0, min: 0 },
    },
    status: { type: String, enum: STATUSES, default: 'submitted' },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, trim: true, maxlength: 2000, default: '' },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
    resolvedAt: Date,
    closedAt: Date,
    // Service level agreement: deadlines come from the SLA policy for the priority.
    sla: {
      responseDueAt: Date,
      resolveDueAt: Date,
      firstResponseAt: { type: Date, default: null },
      responseBreached: { type: Boolean, default: false },
      resolveBreached: { type: Boolean, default: false },
      // 0 none, 1 due-soon warning, 2 breached, 3 priority raised, 4 final escalation
      escalationLevel: { type: Number, default: 0, min: 0, max: 4 },
      lastEscalatedAt: Date,
    },
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
complaintSchema.index({ status: 1, 'sla.resolveDueAt': 1 });
complaintSchema.index({ 'location.place': 1 });
complaintSchema.index({ department: 1, status: 1 });
complaintSchema.index({ asset: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
