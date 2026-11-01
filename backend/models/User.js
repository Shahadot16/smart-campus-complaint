const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    studentId: { type: String, trim: true, maxlength: 30 },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    emailVerified: { type: Boolean, default: false },
    // TOTP two-factor authentication; secrets are never returned by default.
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      pendingSecret: { type: String, select: false },
    },
    // Brute-force protection: the account is locked after repeated failures.
    failedLogins: { type: Number, default: 0 },
    lockUntil: Date,
  },
  { timestamps: true }
);

// studentId is optional but must be unique when present.
userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } }
);
userSchema.index({ role: 1, isActive: 1 });

userSchema.methods.setPassword = async function setPassword(plain) {
  // Lower cost only in automated tests to keep them fast.
  this.passwordHash = await bcrypt.hash(plain, process.env.NODE_ENV === 'test' ? 4 : 12);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
