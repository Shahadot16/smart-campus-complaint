const mongoose = require('mongoose');

// Bookkeeping for background jobs: a lock so only one server instance runs a job at a time.
const jobRunSchema = new mongoose.Schema({
  _id: { type: String },
  lockedUntil: { type: Date, default: null },
  lastRunAt: Date,
  lastResult: { type: mongoose.Schema.Types.Mixed },
  lastError: { type: String, default: '' },
});

module.exports = mongoose.model('JobRun', jobRunSchema);
