const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { generateSync } = require('otplib');
const { app, request, setup, teardown, freshData, accounts, loginAs } = require('./helpers');
const { User, Session, AuditLog, Message, Complaint } = require('../models');
const { DEMO_PASSWORDS } = require('../utils/seed');

before(setup);
after(teardown);

let users;
beforeEach(async () => {
  users = await freshData();
});

const cookieValue = (res, name) => {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(';')[0].slice(name.length + 1) : null;
};

describe('Sessions & refresh tokens', () => {
  it('issues access + refresh cookies and records a session', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'student@iubat.edu', password: DEMO_PASSWORDS.student });
    assert.equal(res.status, 200);
    assert.ok(cookieValue(res, 'scc_token'));
    assert.ok(cookieValue(res, 'scc_refresh'));
    assert.equal(await Session.countDocuments({ user: users.student._id }), 1);
  });

  it('rotates the refresh token and revokes everything when an old one is replayed', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'student@iubat.edu', password: DEMO_PASSWORDS.student });
    const first = cookieValue(login, 'scc_refresh');

    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', `scc_refresh=${first}`);
    assert.equal(r1.status, 200);
    const second = cookieValue(r1, 'scc_refresh');
    assert.ok(second && second !== first);

    // Replaying the first (already rotated) token is treated as theft.
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', `scc_refresh=${first}`);
    assert.equal(replay.status, 401);
    const after = await request(app).post('/api/auth/refresh').set('Cookie', `scc_refresh=${second}`);
    assert.equal(after.status, 401);
  });

  it('cuts off a device immediately when its session is revoked', async () => {
    const phone = await accounts.student();
    const laptop = await accounts.student();
    const list = await laptop.get('/api/auth/sessions');
    assert.equal(list.body.data.length, 2);
    const other = list.body.data.find((s) => !s.current);

    assert.equal((await laptop.delete(`/api/auth/sessions/${other._id}`)).status, 200);
    assert.equal((await phone.get('/api/auth/me')).status, 401);
    assert.equal((await laptop.get('/api/auth/me')).status, 200);
  });

  it('logout revokes the session', async () => {
    const agent = await accounts.student();
    await agent.post('/api/auth/logout');
    assert.equal(await Session.countDocuments({ user: users.student._id, revokedAt: null }), 0);
  });
});

describe('Account lockout', () => {
  it('locks the account after 5 wrong passwords', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: 'student@iubat.edu', password: 'Wrong1234' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: 'student@iubat.edu', password: DEMO_PASSWORDS.student });
    assert.equal(res.status, 423);
    assert.match(res.body.message, /locked/);
  });
});

describe('Email verification & password reset', () => {
  it('verifies a newly registered email with the emailed link', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'New Student', email: 'new@iubat.edu', password: 'Secret123', studentId: '23103999', department: 'CSE',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.emailVerified, false);
    const token = new URL(res.body.data.devLink).searchParams.get('token');

    assert.equal((await request(app).post('/api/auth/verify-email').send({ token })).status, 200);
    assert.equal((await User.findOne({ email: 'new@iubat.edu' })).emailVerified, true);
    // Links are single-use.
    assert.equal((await request(app).post('/api/auth/verify-email').send({ token })).status, 400);
  });

  it('resets a password and signs out all devices', async () => {
    const agent = await accounts.student();
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@iubat.edu' });
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'student@iubat.edu' });
    assert.equal(unknown.body.message, known.body.message); // no account probing

    const token = new URL(known.body.data.devLink).searchParams.get('token');
    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'BrandNew123' });
    assert.equal(reset.status, 200);
    assert.equal((await agent.get('/api/auth/me')).status, 401);
    await loginAs('student@iubat.edu', 'BrandNew123');
  });
});

describe('Two-factor authentication', () => {
  it('requires a TOTP code at login once enabled', async () => {
    const admin = await accounts.admin();
    const setupRes = await admin.post('/api/auth/2fa/setup');
    assert.equal(setupRes.status, 200);
    assert.match(setupRes.body.data.qrDataUrl, /^data:image\/png;base64,/);
    const { secret } = setupRes.body.data;

    assert.equal((await admin.post('/api/auth/2fa/enable').send({ code: '000000' })).status, 400);
    assert.equal((await admin.post('/api/auth/2fa/enable').send({ code: generateSync({ secret }) })).status, 200);

    const step1 = await request(app).post('/api/auth/login').send({ email: 'admin@iubat.edu', password: DEMO_PASSWORDS.admin });
    assert.equal(step1.body.data.twoFactorRequired, true);
    assert.equal(cookieValue(step1, 'scc_token'), null); // no session yet

    const bad = await request(app).post('/api/auth/2fa/login').send({ challengeToken: step1.body.data.challengeToken, code: '123456' });
    assert.equal(bad.status, 401);
    const good = await request(app)
      .post('/api/auth/2fa/login')
      .send({ challengeToken: step1.body.data.challengeToken, code: generateSync({ secret }) });
    assert.equal(good.status, 200);
    assert.ok(cookieValue(good, 'scc_token'));
  });
});

describe('Audit log', () => {
  it('records admin actions and is admin-only', async () => {
    const admin = await accounts.admin();
    await admin.post('/api/admin/categories').send({ name: 'Transport' });
    const res = await admin.get('/api/admin/audit-logs');
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].action, 'category.create');
    assert.equal(res.body.data[0].actor.email, 'admin@iubat.edu');
    assert.equal(await AuditLog.countDocuments(), 1);

    const student = await accounts.student();
    assert.equal((await student.get('/api/admin/audit-logs')).status, 403);
  });
});

describe('Complaint chat', () => {
  it('lets participants chat and blocks outsiders', async () => {
    const complaint = await Complaint.findOne({ student: users.student._id, assignedStaff: users.staff1._id });
    const student = await accounts.student();
    const staff = await accounts.staff();

    const sent = await student.post(`/api/complaints/${complaint._id}/messages`).send({ text: 'Is anyone coming today?' });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.data.sender.name, users.student.name);

    const reply = await staff.post(`/api/complaints/${complaint._id}/messages`).send({ text: 'Yes, at 2 PM.' });
    assert.equal(reply.status, 201);

    const list = await student.get(`/api/complaints/${complaint._id}/messages`);
    assert.deepEqual(list.body.data.map((m) => m.text), ['Is anyone coming today?', 'Yes, at 2 PM.']);

    const outsider = await accounts.student2();
    assert.equal((await outsider.get(`/api/complaints/${complaint._id}/messages`)).status, 403);
    assert.equal((await student.post(`/api/complaints/${complaint._id}/messages`).send({ text: '' })).status, 400);
    assert.equal(await Message.countDocuments(), 2);
  });
});
