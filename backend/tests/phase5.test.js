const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, freshData, accounts, loginAs } = require('./helpers');
const { Complaint, Category, User, ComplaintStatusHistory } = require('../models');

before(setup);
after(teardown);

let users;
let wifi;
beforeEach(async () => {
  users = await freshData();
  wifi = await Complaint.findOne({ title: 'Lab Wi-Fi is not working' });
});

async function extraStudent(i) {
  const u = new User({ name: `Voter ${i}`, email: `voter${i}@iubat.edu`, studentId: `2390000${i}`, role: 'student', emailVerified: true });
  await u.setPassword('Voter1234');
  await u.save();
  return loginAs(`voter${i}@iubat.edu`, 'Voter1234');
}

describe('Me-too votes', () => {
  it('counts one vote per student and never on your own complaint', async () => {
    const owner = await accounts.student();
    assert.equal((await owner.post(`/api/complaints/${wifi._id}/vote`)).status, 400);

    const s2 = await accounts.student2();
    assert.equal((await s2.post(`/api/complaints/${wifi._id}/vote`)).status, 409); // seeded vote already exists
    assert.equal((await s2.delete(`/api/complaints/${wifi._id}/vote`)).body.data.votes, 0);
    assert.equal((await s2.post(`/api/complaints/${wifi._id}/vote`)).body.data.votes, 1);
    assert.equal((await (await accounts.staff()).post(`/api/complaints/${wifi._id}/vote`)).status, 403);
  });

  it('raises the priority once when enough students are affected', async () => {
    const fan = await Complaint.findOne({ title: 'Broken classroom fan' }); // medium
    for (let i = 1; i <= 5; i++) await (await extraStudent(i)).post(`/api/complaints/${fan._id}/vote`);
    const after = await Complaint.findById(fan._id);
    assert.equal(after.votes, 5);
    assert.equal(after.priority, 'high');
    assert.equal(after.votesEscalated, true);
    assert.ok(await ComplaintStatusHistory.exists({ complaint: fan._id, type: 'priority', changedBy: null }));
  });
});

describe('Public board', () => {
  it('lists public open complaints without reporter details', async () => {
    const s2 = await accounts.student2();
    const res = await s2.get('/api/public/complaints');
    assert.equal(res.status, 200);
    const item = res.body.data.find((c) => c.trackingCode === wifi.trackingCode);
    assert.equal(item.student, undefined);
    assert.equal(item.voted, true);
    assert.equal(res.body.data[0].trackingCode, wifi.trackingCode); // most votes first
  });
});

describe('Anonymous reporting', () => {
  it('hides the reporter from staff and department heads but not admins', async () => {
    const student = await accounts.student();
    const cat = await Category.findOne({ name: 'Safety & Security' });
    const res = await student.post('/api/complaints').field('title', 'Harassment near the workshop').field('description', 'Someone has been bothering students near the workshop gate at night.').field('category', String(cat._id)).field('building', 'Engineering Workshop').field('isAnonymous', 'true');
    assert.equal(res.status, 201);
    const c = await Complaint.findById(res.body.data.id);
    assert.equal(c.visibility, 'private'); // never on the public board

    const admin = await accounts.admin();
    await admin.patch(`/api/admin/complaints/${c._id}/assign`).send({ staffId: String(users.staff2._id) });
    const staffView = await (await accounts.staff2()).get(`/api/complaints/${c._id}`);
    assert.equal(staffView.body.data.complaint.student.name, 'Anonymous student');
    assert.ok(staffView.body.data.history.every((h) => h.changedBy?.name !== users.student.name));
    const staffList = await (await accounts.staff2()).get('/api/staff/complaints');
    assert.equal(staffList.body.data.find((x) => x._id === String(c._id)).student.name, 'Anonymous student');

    const adminView = await admin.get(`/api/complaints/${c._id}`);
    assert.equal(adminView.body.data.complaint.student.name, users.student.name);
  });
});

describe('Leaderboard', () => {
  it('ranks reporters and fixers', async () => {
    const res = await (await accounts.student()).get('/api/leaderboard');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.reporters.length > 0);
    assert.ok('points' in res.body.data.reporters[0]);
  });
});
