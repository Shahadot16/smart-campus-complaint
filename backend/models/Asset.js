const mongoose = require('mongoose');

// A physical item on campus (AC, projector, oscilloscope...) whose repairs are tracked.
const assetSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, required: true, trim: true, maxlength: 40 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    department: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
    serialNo: { type: String, trim: true, maxlength: 60, default: '' },
    purchaseDate: Date,
    warrantyUntil: Date,
    status: { type: String, enum: ['operational', 'under_repair', 'retired'], default: 'operational' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

assetSchema.index({ location: 1 });

module.exports = mongoose.model('Asset', assetSchema);
