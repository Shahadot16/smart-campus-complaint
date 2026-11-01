const scheduler = require('./scheduler');
const { checkSla } = require('./slaJob');
const { sendDailyDigest } = require('./digestJob');

// All background jobs of the application.
scheduler.register('sla-check', 60 * 1000, () => checkSla());
scheduler.register('daily-digest', 15 * 60 * 1000, () => sendDailyDigest());

module.exports = scheduler;
