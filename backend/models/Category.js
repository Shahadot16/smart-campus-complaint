const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    isActive: { type: Boolean, default: true },
    // New complaints in this category are assigned to the best-matching staff automatically.
    autoAssign: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.plugin(require('./tenantPlugin'));
categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('Category', categorySchema);
