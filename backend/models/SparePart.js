const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    unit: { type: String, trim: true, maxlength: 12, default: 'pcs' },
    quantity: { type: Number, default: 0, min: 0 },
    minQuantity: { type: Number, default: 0, min: 0 }, // low-stock alert threshold
    unitCost: { type: Number, default: 0, min: 0 }, // BDT
    supplier: { type: String, trim: true, maxlength: 100, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SparePart', sparePartSchema);
