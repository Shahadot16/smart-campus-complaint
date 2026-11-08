const mongoose = require('mongoose');

// Campus location tree: building -> floor -> room/area. Buildings carry map coordinates.
const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ['building', 'floor', 'room'], required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    building: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null }, // top-level ancestor
    // Short unique code printed in QR stickers, e.g. ENG-3-L3
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 24 },
    department: { type: String, trim: true, maxlength: 10, default: '' },
    geo: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

locationSchema.index({ parent: 1, name: 1 });
locationSchema.index({ building: 1 });

locationSchema.plugin(require('./tenantPlugin'));
locationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Location', locationSchema);
