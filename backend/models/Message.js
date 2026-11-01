const mongoose = require('mongoose');

// Chat message inside a complaint, between the student, assigned staff and admins.
const messageSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ complaint: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
