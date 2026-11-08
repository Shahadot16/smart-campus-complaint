/**
 * Self-service white-label settings for a university administrator. Lets an
 * admin edit their own tenant's public profile and branding (name, tagline,
 * colours, logo). Changes flow out through GET /api/meta, so the whole UI
 * re-themes for everyone in that university.
 */
const { Tenant } = require('../models');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/response');

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_LOGO = 500 * 1024; // ~500 KB data URL
const LOGO_OK = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/;

// GET /api/settings/branding — the current university's editable profile + branding
exports.getBranding = async (req, res) => {
  if (!req.tenant) throw ApiError.badRequest('No university in context');
  const t = await Tenant.findById(req.tenant._id).lean();
  if (!t) throw ApiError.notFound('University not found');
  sendSuccess(res, {
    data: {
      name: t.name,
      shortName: t.shortName,
      slug: t.slug,
      website: t.website || '',
      emailDomain: t.emailDomain || '',
      address: t.address || '',
      phone: t.phone || '',
      plan: t.plan,
      branding: t.branding,
    },
  });
};

// PATCH /api/settings/branding — update profile + branding for the current university
exports.updateBranding = async (req, res) => {
  if (!req.tenant) throw ApiError.badRequest('No university in context');
  const t = await Tenant.findById(req.tenant._id);
  if (!t) throw ApiError.notFound('University not found');
  const b = req.body || {};

  if (typeof b.name === 'string' && b.name.trim()) t.name = b.name.trim().slice(0, 120);
  if (typeof b.shortName === 'string' && b.shortName.trim()) t.shortName = b.shortName.trim().slice(0, 40);
  if (typeof b.website === 'string') t.website = b.website.trim().slice(0, 200);
  if (typeof b.address === 'string') t.address = b.address.trim().slice(0, 200);
  if (typeof b.phone === 'string') t.phone = b.phone.trim().slice(0, 40);

  const br = b.branding || {};
  if (typeof br.tagline === 'string') t.branding.tagline = br.tagline.trim().slice(0, 120);
  if (typeof br.primaryColor === 'string') {
    if (!HEX.test(br.primaryColor)) throw ApiError.badRequest('Primary colour must be a hex value like #0a4029');
    t.branding.primaryColor = br.primaryColor;
  }
  if (typeof br.accentColor === 'string') {
    if (!HEX.test(br.accentColor)) throw ApiError.badRequest('Accent colour must be a hex value like #16a34a');
    t.branding.accentColor = br.accentColor;
  }
  if (typeof br.logo === 'string') {
    const logo = br.logo.trim();
    if (logo && !LOGO_OK.test(logo) && !logo.startsWith('/')) {
      throw ApiError.badRequest('Logo must be an uploaded image.');
    }
    if (logo.length > MAX_LOGO) throw ApiError.badRequest('Logo image is too large. Please use a smaller image.');
    t.branding.logo = logo;
  }

  await t.save();
  sendSuccess(res, { message: 'Settings saved', data: { branding: t.branding, name: t.name, shortName: t.shortName } });
};
