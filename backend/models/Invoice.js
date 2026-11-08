const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true },
    plan: { type: String, required: true },
    planName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    period: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    status: { type: String, enum: ['pending', 'paid', 'void'], default: 'pending' },
    method: { type: String, default: '' },
    issuedAt: { type: Date, default: Date.now },
    paidAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invoiceSchema.index({ tenantId: 1, number: 1 }, { unique: true });
invoiceSchema.index({ status: 1, createdAt: -1 });

invoiceSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

invoiceSchema.plugin(require('./tenantPlugin'));

module.exports = mongoose.model('Invoice', invoiceSchema);
