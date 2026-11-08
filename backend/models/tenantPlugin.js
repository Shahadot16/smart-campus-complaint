const mongoose = require('mongoose');
const { getContext } = require('../utils/tenantContext');

/**
 * Mongoose plugin that makes a model tenant-aware (shared-database,
 * row-level multi-tenancy).
 *
 *  - adds an indexed `tenantId` field
 *  - automatically filters every query by the current tenant
 *  - automatically stamps the current tenant on new documents
 *
 * The current tenant comes from the AsyncLocalStorage context set by the
 * tenant middleware. When the context is "bypass" (super admin) or absent
 * (startup/seed), no scoping is applied.
 */
const QUERY_HOOKS = [
  'count',
  'countDocuments',
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'distinct',
];

module.exports = function tenantPlugin(schema) {
  schema.add({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  });

  schema.pre(QUERY_HOOKS, function scopeQuery() {
    const ctx = getContext();
    if (ctx.bypass) return; // super admin / unscoped
    if (ctx.tenantId == null) return; // no tenant chosen (startup/seed/jobs)
    const q = this.getQuery();
    if (q.tenantId === undefined) this.where({ tenantId: ctx.tenantId });
  });

  schema.pre('aggregate', function scopeAggregate() {
    const ctx = getContext();
    if (ctx.bypass || ctx.tenantId == null) return;
    this.pipeline().unshift({
      $match: { tenantId: new mongoose.Types.ObjectId(String(ctx.tenantId)) },
    });
  });

  schema.pre('save', function stampTenant() {
    // On create, always bind the document to the current tenant (isolation).
    if (this.isNew) {
      const ctx = getContext();
      if (ctx.tenantId != null) this.tenantId = ctx.tenantId;
    }
  });

  schema.pre('insertMany', function stampMany(...args) {
    // Mongoose versions differ on arg order, so locate next (fn) and docs (array).
    const next = args.find((a) => typeof a === 'function');
    const docs = args.find((a) => Array.isArray(a));
    const ctx = getContext();
    if (ctx.tenantId != null && Array.isArray(docs)) {
      for (const d of docs) if (d) d.tenantId = ctx.tenantId;
    }
    if (typeof next === 'function') return next();
  });
};
