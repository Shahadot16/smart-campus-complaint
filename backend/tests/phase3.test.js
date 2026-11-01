const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, freshData, accounts, loginAs } = require('./helpers');
const { Complaint, Category, SparePart, WorkOrder, Location, Notification, ComplaintStatusHistory, User } = require('../models');
const { DEMO_PASSWORDS } = require('../utils/seed');

before(setup);
after(teardown);

let users;
let wifi; // CSE complaint (in progress, assigned to staff1)
beforeEach(async () => {
  users = await freshData();
  wifi = await Complaint.findOne({ asset: users.assets['AST-RTR-L3']._id });
});

const cseHead = () => loginAs('cse.head@iubat.edu', DEMO_PASSWORDS.dept_head);
const eeeHead = () => loginAs('eee.head@iubat.edu', DEMO_PASSWORDS.dept_head);

describe('Department heads', () => {
  it('see only their own department', async () => {
    const head = await cseHead();
    const list = await head.get('/api/dept/complaints?limit=50');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length > 0);
    assert.ok(list.body.data.every((c) => c.department === 'CSE'));

    assert.equal((await head.get(`/api/complaints/${wifi._id}`)).status, 200);
    const eee = await Complaint.findOne({ department: 'EEE' });
    assert.equal((await head.get(`/api/complaints/${eee._id}`)).status, 403);

    const stats = await head.get('/api/dept/stats');
    assert.equal(stats.body.data.department, 'CSE');
    assert.equal(stats.body.data.waitingForMe, 1);
    assert.equal((await head.get('/api/admin/complaints')).status, 403);
  });

  it('can only be created with a department', async () => {
    const admin = await accounts.admin();
    const bad = await admin.post('/api/admin/users').send({ name: 'Head', email: 'ce.head@iubat.edu', password: 'Head1234', role: 'dept_head' });
    assert.equal(bad.status, 400);
    const ok = await admin.post('/api/admin/users').send({ name: 'Head', email: 'ce.head@iubat.edu', password: 'Head1234', role: 'dept_head', department: 'CE' });
    assert.equal(ok.status, 201);
  });
});

describe('Work order approvals', () => {
  async function raise(cost) {
    await WorkOrder.deleteMany({ complaint: wifi._id });
    const staff = await accounts.staff();
    return staff.post(`/api/complaints/${wifi._id}/work-orders`).send({ description: 'Replace damaged patch panel', estimatedCost: cost });
  }

  it('auto-approves small jobs', async () => {
    const res = await raise(3000);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'approved');
  });

  it('routes mid-size jobs to the department head only', async () => {
    const res = await raise(8000);
    assert.deepEqual(res.body.data.requiredApprovals, ['dept_head']);
    const id = res.body.data._id;

    assert.equal((await (await eeeHead()).post(`/api/work-orders/${id}/decision`).send({ decision: 'approved' })).status, 403);
    assert.equal((await (await accounts.staff()).post(`/api/work-orders/${id}/decision`).send({ decision: 'approved' })).status, 403);
    assert.equal((await (await accounts.admin()).post(`/api/work-orders/${id}/decision`).send({ decision: 'approved' })).status, 403); // not admin's step

    const head = await cseHead();
    const ok = await head.post(`/api/work-orders/${id}/decision`).send({ decision: 'approved', note: 'Go ahead' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.status, 'approved');
    assert.equal((await head.post(`/api/work-orders/${id}/decision`).send({ decision: 'approved' })).status, 400);
  });

  it('needs head then admin for large jobs, and a reason to reject', async () => {
    const res = await raise(25000);
    assert.deepEqual(res.body.data.requiredApprovals, ['dept_head', 'admin']);
    const id = res.body.data._id;

    await (await cseHead()).post(`/api/work-orders/${id}/decision`).send({ decision: 'approved' });
    assert.equal((await WorkOrder.findById(id)).status, 'pending');

    const admin = await accounts.admin();
    assert.equal((await admin.post(`/api/work-orders/${id}/decision`).send({ decision: 'rejected' })).status, 400);
    const rejected = await admin.post(`/api/work-orders/${id}/decision`).send({ decision: 'rejected', note: 'Use the spare switch in store' });
    assert.equal(rejected.body.data.status, 'rejected');
    assert.ok(await Notification.exists({ user: users.staff1._id, title: /rejected/ }));
  });

  it('allows only one pending work order per complaint', async () => {
    await raise(8000);
    const staff = await accounts.staff();
    const dup = await staff.post(`/api/complaints/${wifi._id}/work-orders`).send({ description: 'Another job', estimatedCost: 9000 });
    assert.equal(dup.status, 409);
  });
});

describe('Spare parts', () => {
  it('deducts stock and adds cost when the assigned staff uses parts', async () => {
    const staff = await accounts.staff();
    const fuse = users.parts['FUSE-10A'];
    const before = (await Complaint.findById(wifi._id)).cost.parts;

    const res = await staff.post(`/api/complaints/${wifi._id}/parts`).send({ part: String(fuse._id), quantity: 4 });
    assert.equal(res.status, 201);
    assert.equal((await SparePart.findById(fuse._id)).quantity, 36);
    assert.equal((await Complaint.findById(wifi._id)).cost.parts, before + 4 * 25);

    const tooMany = await staff.post(`/api/complaints/${wifi._id}/parts`).send({ part: String(fuse._id), quantity: 999 });
    assert.equal(tooMany.status, 400);
    assert.equal((await SparePart.findById(fuse._id)).quantity, 36); // unchanged

    const other = await accounts.staff2();
    assert.equal((await other.post(`/api/complaints/${wifi._id}/parts`).send({ part: String(fuse._id), quantity: 1 })).status, 403);
  });

  it('alerts admins when stock falls to the minimum', async () => {
    const staff = await accounts.staff();
    const probe = users.parts['PROBE-X10']; // 2 in stock, minimum 2
    await staff.post(`/api/complaints/${wifi._id}/parts`).send({ part: String(probe._id), quantity: 1 });
    assert.ok(await Notification.exists({ user: users.admin._id, title: 'Low stock: Oscilloscope probe x10' }));
  });

  it('lets admins receive stock and blocks negative adjustments below zero', async () => {
    const admin = await accounts.admin();
    const tap = users.parts['TAP-BRASS'];
    assert.equal((await admin.post(`/api/admin/parts/${tap._id}/stock`).send({ type: 'in', quantity: 5 })).body.data.quantity, 13);
    assert.equal((await admin.post(`/api/admin/parts/${tap._id}/stock`).send({ type: 'adjust', quantity: -50 })).status, 400);
    const low = await admin.get('/api/parts?lowStock=true');
    assert.ok(low.body.data.some((p) => p.sku === 'LED-TUBE-20W'));
  });
});

describe('Assets', () => {
  it('shows repair history and suggests replacing failing assets', async () => {
    const admin = await accounts.admin();
    const fan = users.assets['AST-FAN-405'];
    const student = await accounts.student();
    const cat = await Category.findOne({ name: 'Electrical' });
    for (let i = 0; i < 2; i++) {
      await student.post('/api/complaints').field('title', `Fan broken again ${i}`).field('description', 'The same ceiling fan stopped working again today.').field('category', String(cat._id)).field('asset', String(fan._id));
    }
    const res = await admin.get(`/api/assets/${fan._id}`);
    assert.equal(res.body.data.stats.totalRepairs, 3);
    assert.equal(res.body.data.replaceSuggested, true);
    assert.match(res.body.data.advice, /consider replacing/);

    const created = await Complaint.findOne({ title: 'Fan broken again 0' });
    assert.equal(created.location.building, 'Main Academic Building'); // location taken from the asset
    assert.equal(created.department, 'EEE');
  });

  it('resolves asset QR codes and protects the register', async () => {
    const student = await accounts.student();
    const scan = await student.get('/api/assets/code/ast-osc-04');
    assert.equal(scan.body.data.name, 'Oscilloscope (Bench 4)');
    assert.equal((await student.get('/api/assets')).status, 403);
    assert.equal((await (await accounts.staff()).get('/api/assets')).status, 200);
  });
});

describe('Smart assignment', () => {
  it('ranks the skilled staff member covering the building first', async () => {
    const admin = await accounts.admin();
    const osc = await Complaint.findOne({ asset: users.assets['AST-OSC-04']._id });
    const res = await admin.get(`/api/admin/complaints/${osc._id}/suggest-staff`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].name, users.staff1.name);
    assert.ok(res.body.data[0].reasons.includes('Skilled in this category'));
    assert.ok(res.body.data[0].score > res.body.data[1].score);
  });

  it('skips staff on leave', async () => {
    const admin = await accounts.admin();
    const today = new Date();
    const staff1 = await User.findById(users.staff1._id);
    await admin.put(`/api/admin/staff/${staff1._id}/profile`).send({
      skills: staff1.staffProfile.skills.map(String),
      zones: staff1.staffProfile.zones.map(String),
      leaves: [{ from: new Date(today.getTime() - 864e5).toISOString(), to: new Date(today.getTime() + 864e5).toISOString(), reason: 'Sick leave' }],
    });
    const osc = await Complaint.findOne({ asset: users.assets['AST-OSC-04']._id });
    const res = await admin.get(`/api/admin/complaints/${osc._id}/suggest-staff`);
    const s1 = res.body.data.find((s) => s.name === users.staff1.name);
    assert.equal(s1.available, false);
    assert.deepEqual(s1.reasons, ['On leave']);
  });

  it('auto-assigns categories with auto-assignment on', async () => {
    const student = await accounts.student();
    const cleaning = await Category.findOne({ name: 'Cleaning' });
    const lib = await Location.findOne({ name: 'Reading Room' });
    const res = await student.post('/api/complaints').field('title', 'Dusty reading tables').field('description', 'Tables in the reading room have not been cleaned for days.').field('category', String(cleaning._id)).field('place', String(lib._id));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.autoAssigned, users.staff2.name);
    const c = await Complaint.findById(res.body.data.id);
    assert.equal(c.status, 'assigned');
    assert.ok(await ComplaintStatusHistory.exists({ complaint: c._id, changedBy: null, note: /Auto-assigned/ }));
  });
});

describe('Permissions', () => {
  it('exposes the role matrix to admins and the user permissions on /me', async () => {
    const admin = await accounts.admin();
    const res = await admin.get('/api/permissions');
    assert.ok(res.body.data.roles.dept_head.includes('workorders.approve'));
    const me = await (await accounts.staff()).get('/api/auth/me');
    assert.ok(me.body.data.user.permissions.includes('inventory.use'));
    assert.equal((await (await accounts.staff()).get('/api/permissions')).status, 403);
  });
});
