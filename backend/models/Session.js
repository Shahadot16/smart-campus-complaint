const mongoose = require('mongoose');

// One document per signed-in device. Only a hash of the refresh token is stored.
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    // Hashes of earlier tokens of this session; presenting one again means the token was stolen.
    previousHashes: { type: [String], default: [], select: false },
    userAgent: { type: String, maxlength: 300, default: '' },
    ip: { type: String, maxlength: 64, default: '' },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sessionSchema.index({ previousHashes: 1 });
// Expired sessions are removed automatically by MongoDB.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
