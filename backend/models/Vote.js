const mongoose = require('mongoose');

// A "me too" from a student affected by the same problem. One per student per complaint.
const voteSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

voteSchema.index({ complaint: 1, user: 1 }, { unique: true });

voteSchema.plugin(require('./tenantPlugin'));
module.exports = mongoose.model('Vote', voteSchema);
