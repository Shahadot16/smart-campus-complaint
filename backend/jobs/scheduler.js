const { JobRun } = require('../models');

/**
 * Tiny MongoDB-backed job scheduler (no Redis needed).
 * Each job runs on an interval; a lock document makes sure only one server
 * instance runs a given job at a time, and the last result is kept for the
 * admin "Background jobs" panel.
 */
const jobs = [];
const timers = [];

function register(name, everyMs, fn) {
  jobs.push({ name, everyMs, fn });
}

/** Runs one job now if no other instance holds its lock. Returns the result or null if skipped. */
async function runJob(job) {
  const now = new Date();
  await JobRun.updateOne({ _id: job.name }, { $setOnInsert: { lockedUntil: null } }, { upsert: true });
  // Take the lock only if nobody holds it (or the holder crashed and it expired).
  const lock = await JobRun.findOneAndUpdate(
    { _id: job.name, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
    { lockedUntil: new Date(now.getTime() + Math.max(job.everyMs, 60000)) }
  );
  if (!lock) return null;

  try {
    const result = await job.fn();
    await JobRun.updateOne({ _id: job.name }, { lastRunAt: new Date(), lastResult: result ?? null, lastError: '', lockedUntil: null });
    return result;
  } catch (err) {
    console.error(`[job:${job.name}] failed:`, err.message);
    await JobRun.updateOne({ _id: job.name }, { lastRunAt: new Date(), lastError: err.message, lockedUntil: null });
    return null;
  }
}

function start() {
  for (const job of jobs) {
    const tick = () => runJob(job).catch((err) => console.error(`[job:${job.name}]`, err.message));
    timers.push(setTimeout(tick, 5000)); // first run shortly after start-up
    timers.push(setInterval(tick, job.everyMs));
  }
  if (jobs.length) console.log(`Background jobs started: ${jobs.map((j) => j.name).join(', ')}`);
}

function stop() {
  timers.splice(0).forEach((t) => clearTimeout(t));
}

const getJob = (name) => jobs.find((j) => j.name === name);

module.exports = { register, start, stop, runJob, getJob, jobs };
