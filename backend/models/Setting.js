const mongoose = require('mongoose');

// Small key/value store for system settings that admins can change (e.g. approval limits).
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
