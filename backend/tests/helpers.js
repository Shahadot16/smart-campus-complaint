process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'scc-test-uploads');

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');
const app = require('../app');
const { seed, reset, DEMO_PASSWORDS } = require('../utils/seed');

let replSet;

async function setup() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDB(replSet.getUri('scc_test'));
}

async function teardown() {
  await disconnectDB();
  await replSet.stop();
}

async function freshData() {
  await reset();
  return seed();
}

/** Returns a supertest agent that keeps the auth cookie. */
async function loginAs(email, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.body.message}`);
  return agent;
}

const accounts = {
  admin: () => loginAs('admin@iubat.edu', DEMO_PASSWORDS.admin),
  staff: () => loginAs('staff@iubat.edu', DEMO_PASSWORDS.staff),
  staff2: () => loginAs('staff2@iubat.edu', DEMO_PASSWORDS.staff),
  student: () => loginAs('student@iubat.edu', DEMO_PASSWORDS.student),
  student2: () => loginAs('student2@iubat.edu', DEMO_PASSWORDS.student),
};

// Smallest valid PNG (1x1 pixel).
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

module.exports = { app, request, setup, teardown, freshData, loginAs, accounts, PNG_1PX };
