const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
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
    // Which events are also sent by email (in-app notifications are always on).
    emailPrefs: {
      statusUpdates: { type: Boolean, default: true },
      assignments: { type: Boolean, default: true },
      slaAlerts: { type: Boolean, default: true },
      chatMessages: { type: Boolean, default: false },
      dailyDigest: { type: Boolean, default: true },
    },
    // Maintenance staff profile used by smart auto-assignment.
    staffProfile: {
      skills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      zones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }], // buildings they usually cover
      maxOpenTasks: { type: Number, default: 6, min: 1, max: 50 },
      leaves: [{ from: Date, to: Date, reason: { type: String, maxlength: 120 } }],
    },
    failedLogins: { type: Number, default: 0 },
    lockUntil: Date,
  },
  { timestamps: true }
);

// Email is unique PER tenant (the same email may exist in two universities);
// super admins have no tenant, so their emails are unique among tenantId:null.
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
// studentId is optional but must be unique within a tenant when present.
userSchema.index(
  { tenantId: 1, studentId: 1 },
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

userSchema.plugin(require('./tenantPlugin'));
module.exports = mongoose.model('User', userSchema);
