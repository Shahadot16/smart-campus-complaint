const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { Tenant } = require('../models');
const { run } = require('../utils/tenantContext');

function readToken(req) {
  const cookieToken = req.cookies?.[config.cookieName];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Finds which tenant a request belongs to:
 *   1. the `X-Tenant` header (used by the SPA, and in local dev)
 *   2. the `?tenant=` query param
 *   3. the subdomain in production (iubat.app.com -> "iubat")
 */
function resolveSlug(req) {
  const header = req.get('x-tenant');
  if (header) return String(header).toLowerCase().trim();
  if (req.query.tenant) return String(req.query.tenant).toLowerCase().trim();
  const host = (req.hostname || '').toLowerCase();
  const labels = host.split('.');
  if (labels.length > 2) {
    const sub = labels[0];
    if (sub && !['www', 'api', 'app', 'admin'].includes(sub)) return sub;
  }
  return null;
}

/**
 * Establishes the tenant context for the whole request. Every tenant-scoped
 * query made downstream is then automatically filtered to this tenant.
 *   - super admins run unscoped (bypass) so they can manage all tenants
 *   - an authenticated user's tenant comes from their token (trusted)
 *   - public requests (login) resolve the tenant from header/subdomain
 */
module.exports = async function tenantContext(req, res, next) {
  // The platform super-admin portal manages every university, so it must never
  // be tenant-scoped — not even when a leftover university session cookie is
  // present. Always run these routes unscoped (bypass) before anything else.
  const fullPath = `${req.baseUrl || ''}${req.path || ''}`;
  if (req.path?.startsWith('/super') || fullPath.includes('/api/super')) {
    req.tenant = null;
    return run({ tenantId: null, bypass: true }, () => next());
  }

  let tokenRole = null;
  let tokenTid = null;
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      tokenRole = payload.role;
      tokenTid = payload.tid || null;
    } catch {
      /* expired/invalid: fall back to header-based resolution */
    }
  }

  // Platform owner: no tenant scoping.
  if (tokenRole === 'super_admin') {
    req.tenant = null;
    return run({ tenantId: null, bypass: true }, () => next());
  }

  let tenant = null;
  try {
    if (tokenTid) tenant = await Tenant.findById(tokenTid);
    else {
      const slug = resolveSlug(req);
      if (slug) tenant = await Tenant.findOne({ slug });
    }
  } catch {
    /* ignore lookup errors; handled as "no tenant" below */
  }

  if (tenant && tenant.status === 'suspended') {
    return res
      .status(403)
      .json({ success: false, message: `${tenant.name} is currently suspended. Please contact the platform administrator.` });
  }

  req.tenant = tenant || null;
  return run({ tenantId: tenant ? tenant._id : null, bypass: false }, () => next());
};
