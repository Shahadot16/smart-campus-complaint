const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 10 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    programs: [{ type: String, trim: true, maxlength: 20 }],
    url: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.plugin(require('./tenantPlugin'));
departmentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Department', departmentSchema);
