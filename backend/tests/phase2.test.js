const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, freshData, accounts } = require('./helpers');
const { Complaint, Category, Location, Notification, ComplaintStatusHistory, User } = require('../models');
const { checkSla } = require('../jobs/slaJob');
const { sendDailyDigest } = require('../jobs/digestJob');

before(setup);
after(teardown);

const HOUR = 36e5;
let users;
let category;
beforeEach(async () => {
  users = await freshData();
  category = await Category.findOne({ name: 'Network & IT' });
});

async function create(agent, fields = {}) {
  let req = agent.post('/api/complaints');
  const all = {
    title: 'Router keeps restarting',
    description: 'The lab router restarts every few minutes, dropping all connections.',
    category: String(category._id),
    building: 'Engineering Building',
    priority: 'high',
    ...fields,
  };
  for (const [k, v] of Object.entries(all)) req = req.field(k, v);
  const res = await req;
  assert.equal(res.status, 201, res.body.message);
  return Complaint.findById(res.body.data.id);
}

const near = (date, expectedMs) => Math.abs(new Date(date).getTime() - expectedMs) < 5000;

describe('SLA deadlines', () => {
  it('sets response and resolution deadlines from the priority', async () => {
    const c = await create(await accounts.student(), { priority: 'high' });
    const t0 = c.createdAt.getTime();
    assert.ok(near(c.sla.responseDueAt, t0 + 4 * HOUR));
    assert.ok(near(c.sla.resolveDueAt, t0 + 24 * HOUR));
  });

  it('uses admin-configured policies and recalculates on priority change', async () => {
    const admin = await accounts.admin();
    const bad = await admin.put('/api/admin/sla-policies').send({ priority: 'medium', responseHours: 10, resolveHours: 5 });
    assert.equal(bad.status, 400);
    const ok = await admin.put('/api/admin/sla-policies').send({ priority: 'medium', responseHours: 2, resolveHours: 12 });
    assert.equal(ok.status, 200);

    const c = await create(await accounts.student(), { priority: 'medium' });
    assert.ok(near(c.sla.resolveDueAt, c.createdAt.getTime() + 12 * HOUR));

    await admin.patch(`/api/admin/complaints/${c._id}/priority`).send({ priority: 'critical' });
    const after = await Complaint.findById(c._id);
    assert.ok(near(after.sla.resolveDueAt, c.createdAt.getTime() + 8 * HOUR));
  });

  it('records the first response when an admin acts', async () => {
    const c = await create(await accounts.student());
    assert.equal(c.sla.firstResponseAt, null);
    const admin = await accounts.admin();
    await admin.patch(`/api/admin/complaints/${c._id}/assign`).send({ staffId: String(users.staff1._id) });
    assert.ok((await Complaint.findById(c._id)).sla.firstResponseAt);
  });
});

describe('SLA escalation job', () => {
  it('flags a missed response deadline once and alerts admins', async () => {
    const c = await create(await accounts.student(), { priority: 'high' });
    const later = new Date(c.createdAt.getTime() + 5 * HOUR);
    assert.ok((await checkSla(later)).responseBreaches >= 1);
    assert.equal((await checkSla(later)).responseBreaches, 0); // not repeated
    assert.ok((await Complaint.findById(c._id)).sla.responseBreached);
    assert.ok(await Notification.exists({ user: users.admin._id, title: `SLA: ${c.trackingCode} needs a response` }));
  });

  it('warns, breaches, raises priority and finally escalates an overdue complaint', async () => {
    const c = await create(await accounts.student(), { priority: 'high' }); // 24h to resolve
    const admin = await accounts.admin();
    await admin.patch(`/api/admin/complaints/${c._id}/assign`).send({ staffId: String(users.staff1._id) });
    const t0 = c.createdAt.getTime();

    const level = async () => (await Complaint.findById(c._id)).sla.escalationLevel;

    await checkSla(new Date(t0 + 20 * HOUR));
    assert.equal(await level(), 1);
    await checkSla(new Date(t0 + 25 * HOUR));
    let doc = await Complaint.findById(c._id);
    assert.equal(doc.sla.resolveBreached, true);
    assert.equal(doc.sla.escalationLevel, 2);

    await checkSla(new Date(t0 + 37 * HOUR));
    doc = await Complaint.findById(c._id);
    assert.equal(doc.priority, 'critical');

    await checkSla(new Date(t0 + 49 * HOUR));
    assert.equal(await level(), 4);
    const events = await ComplaintStatusHistory.countDocuments({ complaint: c._id, changedBy: null });
    assert.equal(events, 3); // breach, priority raise, final escalation
  });

  it('reports SLA compliance', async () => {
    const admin = await accounts.admin();
    const res = await admin.get('/api/admin/reports/sla');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.resolution.total > 0);
    assert.equal(res.body.data.byPriority.length, 4);
  });

  it('lists and runs background jobs on demand', async () => {
    const admin = await accounts.admin();
    const list = await admin.get('/api/admin/jobs');
    assert.deepEqual(list.body.data.map((j) => j.name).sort(), ['daily-digest', 'sla-check']);
    const run = await admin.post('/api/admin/jobs/sla-check/run');
    assert.equal(run.status, 200);
    assert.equal(typeof run.body.data.breaches, 'number');
    assert.equal((await (await accounts.staff()).get('/api/admin/jobs')).status, 403);
  });

  it('builds the daily digest for admins', async () => {
    const result = await sendDailyDigest(new Date(), { force: true });
    assert.equal(result.recipients, 1);
    assert.ok(result.open > 0);
  });
});

describe('Campus locations & QR codes', () => {
  it('returns the campus tree and resolves QR codes', async () => {
    const student = await accounts.student();
    const tree = await student.get('/api/locations');
    assert.equal(tree.status, 200);
    const eng = tree.body.data.tree.find((b) => b.code === 'ENG');
    assert.ok(eng.children.length >= 3);

    const lab = await Location.findOne({ name: 'CSE Lab 3' });
    const scan = await student.get(`/api/locations/code/${lab.code.toLowerCase()}`);
    assert.equal(scan.body.data.building.name, 'Engineering Building');
    assert.equal((await student.get('/api/locations/code/NOPE-1')).status, 404);
  });

  it('fills building and room from a chosen location', async () => {
    const lab = await Location.findOne({ name: 'CSE Lab 3' });
    const c = await create(await accounts.student(), { building: '', place: String(lab._id) });
    assert.equal(c.location.building, 'Engineering Building');
    assert.equal(c.location.room, '2nd floor, CSE Lab 3');
    assert.equal(String(c.location.place), String(lab._id));
  });

  it('lets admins add locations with hierarchy checks', async () => {
    const admin = await accounts.admin();
    const eng = await Location.findOne({ code: 'ENG' });
    const room = await Location.findOne({ name: 'CSE Lab 1' });

    const floor = await admin.post('/api/admin/locations').send({ name: '5th floor', type: 'floor', parent: String(eng._id), code: 'ENG-F5' });
    assert.equal(floor.status, 201);
    const dup = await admin.post('/api/admin/locations').send({ name: 'Dup', type: 'floor', parent: String(eng._id), code: 'eng-f5' });
    assert.equal(dup.status, 409);
    const wrong = await admin.post('/api/admin/locations').send({ name: 'Bad', type: 'floor', parent: String(room._id), code: 'BAD-1' });
    assert.equal(wrong.status, 400);

    const stats = await admin.get('/api/locations/stats');
    const engStats = stats.body.data.buildings.find((b) => b.code === 'ENG');
    assert.ok(engStats.total > 0 && engStats.geo.lat);
  });
});

describe('Email preferences', () => {
  it('saves notification email preferences on the profile', async () => {
    const student = await accounts.student();
    const res = await student.patch('/api/auth/me').send({ emailPrefs: { statusUpdates: false, unknownKey: true } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.emailPrefs.statusUpdates, false);
    const stored = await User.findById(users.student._id).lean();
    assert.equal(stored.emailPrefs.unknownKey, undefined);
  });
});
