/**
 * Per-request tenant context using AsyncLocalStorage.
 *
 * The tenant resolution middleware wraps each request in `run()`, so every
 * database query made while handling that request can read the current tenant
 * (via the Mongoose tenant plugin) without the controllers having to pass it
 * around. This is what keeps one university's data isolated from another's.
 *
 * context shape: { tenantId: ObjectId|string|null, bypass: boolean }
 *   - tenantId set  -> queries are scoped to that tenant
 *   - bypass: true  -> no scoping (super admin / cross-tenant background jobs)
 *   - no context    -> no scoping (setup/seed before a tenant is chosen)
 */
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function run(context, fn) {
  return storage.run(context || {}, fn);
}

function getContext() {
  return storage.getStore() || {};
}

function getTenantId() {
  const ctx = storage.getStore();
  return ctx ? ctx.tenantId ?? null : null;
}

function isBypassed() {
  const ctx = storage.getStore();
  return Boolean(ctx && ctx.bypass);
}

/** Run a function scoped to one tenant (used by the seed and per-tenant jobs). */
function runAsTenant(tenantId, fn) {
  return storage.run({ tenantId, bypass: false }, fn);
}

/** Run a function with no tenant scoping (super admin / platform-wide jobs). */
function runUnscoped(fn) {
  return storage.run({ tenantId: null, bypass: true }, fn);
}

module.exports = { run, getContext, getTenantId, isBypassed, runAsTenant, runUnscoped, storage };
