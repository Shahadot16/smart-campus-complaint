const mongoose = require('mongoose');

/**
 * A Tenant is one university/organization on the platform. All tenant-scoped
 * collections carry a `tenantId` pointing here. The Tenant document itself is
 * NOT tenant-scoped (only the super admin manages tenants).
 */
const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    shortName: { type: String, required: true, trim: true, maxlength: 30 },
    // URL-safe identifier used as the subdomain (iubat.app.com) and the X-Tenant header.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]{2,40}$/, 'Slug may contain only lowercase letters, numbers and hyphens'],
    },
    emailDomain: { type: String, trim: true, lowercase: true, default: '' },
    website: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, maxlength: 240, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    location: {
      lat: { type: Number, default: 23.8103 },
      lng: { type: Number, default: 90.4125 },
    },
    // White-label branding, applied across the tenant's UI.
    branding: {
      logo: { type: String, default: '' },
      logoWide: { type: String, default: '' },
      primaryColor: { type: String, default: '#0a4029' }, // navy-900 (IUBAT green)
      accentColor: { type: String, default: '#16a34a' }, // brand-500
      tagline: { type: String, default: 'Complaint & maintenance portal', maxlength: 120 },
    },
    plan: { type: String, enum: ['free', 'pro', 'premium'], default: 'free' },
    subscription: {
      status: { type: String, enum: ['active', 'past_due', 'canceled'], default: 'active' },
      currentPeriodEnd: Date,
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    // Lightweight usage snapshot (kept fresh by the super-admin dashboard query).
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

tenantSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Tenant', tenantSchema);
