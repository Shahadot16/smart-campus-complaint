const mongoose = require('mongoose');
const { PRIORITIES } = require('../utils/constants');

// Response/resolution targets per priority. `category` optionally overrides the default for one category.
const slaPolicySchema = new mongoose.Schema(
  {
    priority: { type: String, enum: PRIORITIES, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    responseHours: { type: Number, required: true, min: 0.25, max: 720 },
    resolveHours: { type: Number, required: true, min: 0.5, max: 2160 },
  },
  { timestamps: true }
);

slaPolicySchema.index({ tenantId: 1, priority: 1, category: 1 }, { unique: true });

slaPolicySchema.plugin(require('./tenantPlugin'));
module.exports = mongoose.model('SlaPolicy', slaPolicySchema);
