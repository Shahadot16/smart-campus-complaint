const path = require('path');
const mongoose = require('mongoose');
const config = require('./env');

let memoryServer = null;
let transactionsSupported = false;

/**
 * Connects to MongoDB.
 * MONGO_URI=memory starts an embedded MongoDB replica set (data persisted in
 * backend/.mongo-data) so the project runs without installing MongoDB.
 */
async function connectDB(uri = config.mongoUri) {
  let target = uri;

  if (uri === 'memory') {
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    const dbPath = path.join(__dirname, '..', '.mongo-data');
    require('fs').mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
      instanceOpts: [{ port: 27117, dbPath }],
    });
    target = memoryServer.getUri('smart_campus_complaint_db');
    console.log('Using embedded MongoDB (data in backend/.mongo-data)');
  }

  await mongoose.connect(target);
  transactionsSupported = await detectTransactionSupport();
  console.log(
    `MongoDB connected: ${mongoose.connection.name} (transactions ${transactionsSupported ? 'enabled' : 'unavailable'})`
  );
  return mongoose.connection;
}

async function detectTransactionSupport() {
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    return Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    return false;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

/**
 * Runs `fn(session)` inside a transaction when the deployment supports it.
 * On standalone servers it runs without a session, so callers must order
 * their writes so that a failure leaves no inconsistent state.
 */
async function withTransaction(fn) {
  if (!transactionsSupported) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { connectDB, disconnectDB, withTransaction };
