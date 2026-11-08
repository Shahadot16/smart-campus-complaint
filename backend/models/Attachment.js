const mongoose = require('mongoose');
const { ALLOWED_IMAGE_TYPES } = require('../utils/constants');

const attachmentSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    fileUrl: { type: String, required: true },
    storageKey: { type: String, required: true },
    originalName: { type: String, trim: true, maxlength: 200 },
    mimeType: { type: String, enum: ALLOWED_IMAGE_TYPES, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['evidence', 'resolution'], default: 'evidence' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

attachmentSchema.plugin(require('./tenantPlugin'));
module.exports = mongoose.model('Attachment', attachmentSchema);
