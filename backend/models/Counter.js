const mongoose = require('mongoose');

// Atomic sequence counters (used to generate yearly tracking codes).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function next(key, session) {
  const doc = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
