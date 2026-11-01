const mongoose = require('mongoose');

// Every change to spare-part stock: purchases (in), usage on a repair (out) or corrections (adjust).
const stockMovementSchema = new mongoose.Schema(
  {
    part: { type: mongoose.Schema.Types.ObjectId, ref: 'SparePart', required: true },
    type: { type: String, enum: ['in', 'out', 'adjust'], required: true },
    quantity: { type: Number, required: true }, // signed: + adds stock, - removes stock
    unitCost: { type: Number, default: 0, min: 0 },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ part: 1, createdAt: -1 });
stockMovementSchema.index({ complaint: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
