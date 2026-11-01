const http = require('http');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');
const initSockets = require('./sockets');
const jobs = require('./jobs');
const { seedIfEmpty } = require('./utils/seed');

async function start() {
  try {
    await connectDB();
    // Fresh embedded databases (or SEED_DEMO=true) get demo data so the app is usable immediately.
    if (config.mongoUri === 'memory' || process.env.SEED_DEMO === 'true') await seedIfEmpty();

    // One HTTP server carries both the REST API and Socket.IO.
    const server = http.createServer(app);
    const io = initSockets(server);

    server.listen(config.port, () => {
      console.log(`API listening on http://localhost:${config.port}/api (${config.env})`);
    });
    jobs.start();

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down...`);
      jobs.stop();
      io.close();
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
