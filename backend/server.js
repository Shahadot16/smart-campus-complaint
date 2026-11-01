const http = require('http');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');
const initSockets = require('./sockets');
const { seedIfEmpty } = require('./utils/seed');

async function start() {
  try {
    await connectDB();
    // Fresh embedded databases get demo data so the app is usable immediately.
    if (config.mongoUri === 'memory') await seedIfEmpty();

    // One HTTP server carries both the REST API and Socket.IO.
    const server = http.createServer(app);
    const io = initSockets(server);

    server.listen(config.port, () => {
      console.log(`API listening on http://localhost:${config.port}/api (${config.env})`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down...`);
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
