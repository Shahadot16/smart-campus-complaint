const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, freshData, accounts, PNG_1PX } = require('./helpers');
const { User, Complaint, ComplaintStatusHistory, Category } = require('../models');

before(setup);
after(teardown);

let users;
let category;
beforeEach(async () => {
  users = await freshData();
  category = await Category.findOne({ name: 'Network' });
});

async function createComplaint(agent, overrides = {}) {
  const fields = {
    title: 'Projector not working',
    description: 'The projector in room 301 shows no signal at all.',
    category: String(category._id),
    building: 'Building A',
    room: '301',
    priority: 'high',
    ...overrides,
  };
  let req = agent.post('/api/complaints');
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  return req;
}

describe('Authentication', () => {
  it('T-01 registers a student and stores only a password hash', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'New Student',
      email: 'new@campus.edu',
      password: 'Secret123',
      studentId: 'CSE-2026-777',
      department: 'CSE',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.role, 'student');
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);

    const stored = await User.findOne({ email: 'new@campus.edu' }).select('+passwordHash');
    assert.notEqual(stored.passwordHash, 'Secret123');
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
  });

  it('ignores a client-supplied role during registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sneaky', email: 'sneaky@campus.edu', password: 'Secret123', studentId: 'X-001', role: 'admin',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'student');
  });

  it('T-02 rejects duplicate email and duplicate student ID with 409', async () => {
    const dupEmail = await request(app).post('/api/auth/register').send({
      name: 'Dup', email: 'student@campus.edu', password: 'Secret123', studentId: 'NEW-1',
    });
    assert.equal(dupEmail.status, 409);
    assert.equal(dupEmail.body.message, 'Email already exists');

    const dupId = await request(app).post('/api/auth/register').send({
      name: 'Dup', email: 'other@campus.edu', password: 'Secret123', studentId: 'CSE-2026-001',
    });
    assert.equal(dupId.status, 409);
    assert.equal(dupId.body.message, 'Student ID already exists');
  });

  it('T-03 denies login with an incorrect password without leaking details', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'student@campus.edu', password: 'Wrong123' });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { success: false, message: 'Invalid email or password' });
  });

  it('rejects protected routes without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('blocks deactivated users', async () => {
    await User.updateOne({ email: 'student@campus.edu' }, { isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'student@campus.edu', password: 'Student@123' });
    assert.equal(res.status, 403);
  });
});

describe('Complaints', () => {
  it('T-04 saves a valid complaint with a tracking code and submitted status', async () => {
    const student = await accounts.student();
    const res = await createComplaint(student);
    assert.equal(res.status, 201);
    assert.match(res.body.data.trackingCode, /^CMP-\d{4}-\d{4}$/);
    assert.equal(res.body.data.status, 'submitted');

    const history = await ComplaintStatusHistory.find({ complaint: res.body.data.id });
    assert.equal(history.length, 1);
    assert.equal(history[0].newStatus, 'submitted');
  });

  it('generates unique tracking codes for concurrent submissions', async () => {
    const student = await accounts.student();
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => createComplaint(student)));
    const codes = results.map((r) => r.body.data.trackingCode);
    assert.equal(new Set(codes).size, 5);
  });

  it('validates complaint input on the server', async () => {
    const student = await accounts.student();
    const res = await createComplaint(student, { title: 'abc', priority: 'urgent' });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.errors.some((e) => e.field === 'title'));
  });

  it('rejects deactivated categories for new complaints', async () => {
    await Category.updateOne({ _id: category._id }, { isActive: false });
    const student = await accounts.student();
    const res = await createComplaint(student);
    assert.equal(res.status, 400);
  });

  it("T-05 denies access to another student's complaint", async () => {
    const owner = await accounts.student();
    const created = await createComplaint(owner);
    const other = await accounts.student2();
    const res = await other.get(`/api/complaints/${created.body.data.id}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'You are not allowed to access this complaint');
  });

  it('prevents owners from changing status through the edit endpoint', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const res = await student.patch(`/api/complaints/${created.body.data.id}`).send({ status: 'resolved' });
    assert.equal(res.status, 400);
    const c = await Complaint.findById(created.body.data.id);
    assert.equal(c.status, 'submitted');
  });

  it('hides internal admin notes from students', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const admin = await accounts.admin();
    await admin.post(`/api/complaints/${created.body.data.id}/notes`).send({ note: 'Budget approval needed', internal: true });
    const res = await student.get(`/api/complaints/${created.body.data.id}`);
    assert.equal(res.status, 200);
    assert.ok(!res.body.data.history.some((h) => h.note === 'Budget approval needed'));
  });
});

describe('Assignment & workflow', () => {
  it('T-06 assigns an active staff member and records history', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const admin = await accounts.admin();
    const res = await admin
      .patch(`/api/admin/complaints/${created.body.data.id}/assign`)
      .send({ staffId: String(users.staff1._id), priority: 'critical' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'assigned');

    const history = await ComplaintStatusHistory.find({ complaint: created.body.data.id }).sort({ createdAt: 1 });
    const statuses = history.filter((h) => h.type === 'status').map((h) => h.newStatus);
    assert.deepEqual(statuses, ['submitted', 'under_review', 'assigned']);
    assert.ok(history.some((h) => h.type === 'priority'));
  });

  it('refuses to assign inactive staff or non-staff users', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const admin = await accounts.admin();
    await User.updateOne({ _id: users.staff2._id }, { isActive: false });
    const inactive = await admin.patch(`/api/admin/complaints/${created.body.data.id}/assign`).send({ staffId: String(users.staff2._id) });
    assert.equal(inactive.status, 400);
    const notStaff = await admin.patch(`/api/admin/complaints/${created.body.data.id}/assign`).send({ staffId: String(users.student._id) });
    assert.equal(notStaff.status, 400);
  });

  it('T-07 denies status updates from unassigned staff', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const admin = await accounts.admin();
    await admin.patch(`/api/admin/complaints/${created.body.data.id}/assign`).send({ staffId: String(users.staff1._id) });

    const otherStaff = await accounts.staff2();
    const res = await otherStaff.patch(`/api/staff/complaints/${created.body.data.id}/status`).send({ status: 'in_progress' });
    assert.equal(res.status, 403);
    const c = await Complaint.findById(created.body.data.id);
    assert.equal(c.status, 'assigned');
  });

  it('T-08 rejects invalid transitions without partial changes', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const admin = await accounts.admin();
    const before = await ComplaintStatusHistory.countDocuments({ complaint: created.body.data.id });

    const res = await admin.patch(`/api/admin/complaints/${created.body.data.id}/status`).send({ status: 'resolved', note: 'done' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Invalid status transition/);

    const c = await Complaint.findById(created.body.data.id);
    assert.equal(c.status, 'submitted');
    assert.equal(c.resolutionNote, '');
    assert.equal(await ComplaintStatusHistory.countDocuments({ complaint: created.body.data.id }), before);
  });

  it('requires a reason when rejecting', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const admin = await accounts.admin();
    const res = await admin.patch(`/api/admin/complaints/${created.body.data.id}/status`).send({ status: 'rejected' });
    assert.equal(res.status, 400);
  });

  it('T-11 keeps complaint and history consistent through the full lifecycle', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const id = created.body.data.id;
    const admin = await accounts.admin();
    const staff = await accounts.staff();

    assert.equal((await admin.patch(`/api/admin/complaints/${id}/assign`).send({ staffId: String(users.staff1._id) })).status, 200);
    assert.equal((await staff.patch(`/api/staff/complaints/${id}/status`).send({ status: 'in_progress' })).status, 200);
    assert.equal((await staff.patch(`/api/staff/complaints/${id}/status`).send({ status: 'resolved' })).status, 400); // note required
    assert.equal(
      (await staff.patch(`/api/staff/complaints/${id}/status`).send({ status: 'resolved', note: 'Replaced HDMI cable' })).status,
      200
    );
    assert.equal((await student.post(`/api/complaints/${id}/close`).send({})).status, 200);

    const c = await Complaint.findById(id);
    assert.equal(c.status, 'closed');
    assert.equal(c.resolutionNote, 'Replaced HDMI cable');

    const history = await ComplaintStatusHistory.find({ complaint: id, type: 'status' }).sort({ createdAt: 1 });
    assert.deepEqual(
      history.map((h) => h.newStatus),
      ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed']
    );
    // Each entry's oldStatus chains from the previous newStatus.
    for (let i = 1; i < history.length; i += 1) assert.equal(history[i].oldStatus, history[i - 1].newStatus);
    assert.equal(history.at(-1).newStatus, c.status);
  });

  it('lets students request a reopen and admins reopen', async () => {
    const resolved = await Complaint.findOne({ status: 'resolved' });
    const student = await accounts.student();
    assert.equal((await student.post(`/api/complaints/${resolved._id}/reopen-request`).send({ reason: 'Leak is back again' })).status, 200);
    const admin = await accounts.admin();
    const res = await admin.patch(`/api/admin/complaints/${resolved._id}/status`).send({ status: 'in_progress', note: 'Reopened' });
    assert.equal(res.status, 200);
    const c = await Complaint.findById(resolved._id);
    assert.equal(c.status, 'in_progress');
    assert.equal(c.reopenRequest.requested, false);
  });
});

describe('Attachments', () => {
  it('accepts a genuine image', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const res = await student
      .post(`/api/complaints/${created.body.data.id}/attachments`)
      .attach('images', PNG_1PX, { filename: 'photo.png', contentType: 'image/png' });
    assert.equal(res.status, 201);
    const file = await student.get(res.body.data[0].fileUrl);
    assert.equal(file.status, 200);
    assert.equal(file.headers['content-type'], 'image/png');

    const other = await accounts.student2();
    assert.equal((await other.get(res.body.data[0].fileUrl)).status, 403);
  });

  it('T-09 rejects files that are not real images', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const fake = await student
      .post(`/api/complaints/${created.body.data.id}/attachments`)
      .attach('images', Buffer.from('<script>alert(1)</script> this is not an image'), {
        filename: 'evil.png',
        contentType: 'image/png',
      });
    assert.equal(fake.status, 400);

    const pdf = await student
      .post(`/api/complaints/${created.body.data.id}/attachments`)
      .attach('images', Buffer.from('%PDF-1.4 test'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    assert.equal(pdf.status, 400);
  });

  it('T-09 rejects oversized images', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const big = Buffer.concat([PNG_1PX, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await student
      .post(`/api/complaints/${created.body.data.id}/attachments`)
      .attach('images', big, { filename: 'big.png', contentType: 'image/png' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /MB or smaller/);
  });
});

describe('Feedback', () => {
  it('T-10 rejects ratings outside 1–5', async () => {
    const resolved = await Complaint.findOne({ status: 'resolved' });
    const student = await accounts.student();
    for (const rating of [0, 6, 3.5]) {
      const res = await student.post(`/api/complaints/${resolved._id}/feedback`).send({ rating });
      assert.equal(res.status, 400, `rating ${rating} should be rejected`);
    }
    const ok = await student.post(`/api/complaints/${resolved._id}/feedback`).send({ rating: 4, comment: 'Good' });
    assert.equal(ok.status, 201);
    const again = await student.post(`/api/complaints/${resolved._id}/feedback`).send({ rating: 5 });
    assert.equal(again.status, 409);
  });

  it('rejects feedback before resolution', async () => {
    const student = await accounts.student();
    const created = await createComplaint(student);
    const res = await student.post(`/api/complaints/${created.body.data.id}/feedback`).send({ rating: 5 });
    assert.equal(res.status, 400);
  });
});

describe('Admin', () => {
  it('blocks non-admins from admin routes', async () => {
    const student = await accounts.student();
    assert.equal((await student.get('/api/admin/complaints')).status, 403);
    const staff = await accounts.staff();
    assert.equal((await staff.get('/api/admin/users')).status, 403);
  });

  it('filters and paginates complaints server-side', async () => {
    const admin = await accounts.admin();
    const res = await admin.get('/api/admin/complaints?status=closed&limit=1&page=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.meta.total, 2);
    assert.equal(res.body.meta.totalPages, 2);
    assert.ok(res.body.data.every((c) => c.status === 'closed'));
  });

  it('returns report aggregates', async () => {
    const admin = await accounts.admin();
    const res = await admin.get('/api/admin/reports');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.counts.total, 9);
    assert.ok(res.body.data.byCategory.length > 0);
  });

  it('manages categories with conflict detection', async () => {
    const admin = await accounts.admin();
    const created = await admin.post('/api/admin/categories').send({ name: 'Transport', description: 'Buses' });
    assert.equal(created.status, 201);
    const dup = await admin.post('/api/admin/categories').send({ name: 'transport' });
    assert.equal(dup.status, 409);
    const off = await admin.patch(`/api/admin/categories/${created.body.data._id}`).send({ isActive: false });
    assert.equal(off.body.data.isActive, false);
  });

  it('creates staff accounts and prevents self-deactivation', async () => {
    const admin = await accounts.admin();
    const res = await admin
      .post('/api/admin/users')
      .send({ name: 'New Staff', email: 'newstaff@campus.edu', password: 'Staff1234', role: 'staff' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, 'staff');
    const self = await admin.patch(`/api/admin/users/${users.admin._id}`).send({ isActive: false });
    assert.equal(self.status, 400);
  });
});

describe('Errors', () => {
  it('returns consistent JSON for unknown routes and bad ids', async () => {
    const missing = await request(app).get('/api/nope');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.success, false);

    const admin = await accounts.admin();
    const bad = await admin.get('/api/complaints/not-an-id');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.stack, undefined);
  });
});
