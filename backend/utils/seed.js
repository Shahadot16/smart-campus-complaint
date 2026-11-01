/**
 * Demo data: categories, admin/staff/student accounts and sample complaints.
 *   npm run seed            -> seed only if the database is empty
 *   npm run seed -- --reset -> wipe all collections and reseed
 * Admin credentials can be overridden with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
const { User, Category, Complaint, ComplaintStatusHistory, Feedback, Counter, Attachment, Notification } = require('../models');

const DEMO_PASSWORDS = { admin: 'Admin@123', staff: 'Staff@123', student: 'Student@123' };

const CATEGORIES = [
  ['Network', 'Wi-Fi, LAN and internet connectivity'],
  ['Electrical', 'Lights, fans, sockets and power supply'],
  ['Cleaning', 'Washrooms, classrooms and common areas'],
  ['Equipment', 'Projectors, computers and lab equipment'],
  ['Plumbing', 'Water supply, taps and leakages'],
  ['Furniture', 'Desks, chairs and boards'],
  ['Security', 'Doors, locks, CCTV and safety concerns'],
];

const day = 24 * 60 * 60 * 1000;
const ago = (days, hours = 0) => new Date(Date.now() - days * day - hours * 36e5);

async function makeUser(data, password) {
  const user = new User(data);
  await user.setPassword(password);
  return user.save();
}

async function seed() {
  const cats = Object.fromEntries(
    (await Category.insertMany(CATEGORIES.map(([name, description]) => ({ name, description })))).map((c) => [c.name, c])
  );

  const admin = await makeUser(
    { name: 'Campus Admin', email: process.env.SEED_ADMIN_EMAIL || 'admin@campus.edu', role: 'admin', department: 'Facilities Office' },
    process.env.SEED_ADMIN_PASSWORD || DEMO_PASSWORDS.admin
  );
  const staff1 = await makeUser(
    { name: 'Rahim Uddin', email: 'staff@campus.edu', role: 'staff', department: 'Electrical & Network', phone: '+8801700000001' },
    DEMO_PASSWORDS.staff
  );
  const staff2 = await makeUser(
    { name: 'Karim Hossain', email: 'staff2@campus.edu', role: 'staff', department: 'Maintenance', phone: '+8801700000002' },
    DEMO_PASSWORDS.staff
  );
  const student = await makeUser(
    { name: 'Anisha Rahman', email: 'student@campus.edu', studentId: 'CSE-2026-001', role: 'student', department: 'Computer Science' },
    DEMO_PASSWORDS.student
  );
  const student2 = await makeUser(
    { name: 'Tanvir Ahmed', email: 'student2@campus.edu', studentId: 'EEE-2026-014', role: 'student', department: 'Electrical Engineering' },
    DEMO_PASSWORDS.student
  );

  // [student, category, title, description, building, room, priority, final status, staff, days ago]
  const samples = [
    [student, 'Network', 'Lab Wi-Fi is not working', 'Several computers in the lab cannot connect to the internet since Monday morning.', 'Building A', '302', 'high', 'in_progress', staff1, 3],
    [student, 'Electrical', 'Broken classroom fan', 'The ceiling fan near the window makes a loud noise and stops frequently.', 'Building B', '105', 'medium', 'assigned', staff1, 2],
    [student, 'Cleaning', 'Washroom needs cleaning', 'The second floor washroom has not been cleaned for two days and has no soap.', 'Building C', '2F', 'low', 'closed', staff2, 12],
    [student, 'Equipment', 'Projector not working', 'The projector in the seminar room shows no signal with any laptop.', 'Building A', '401', 'high', 'submitted', null, 0],
    [student, 'Plumbing', 'Water leakage in corridor', 'Water is leaking from the ceiling near the stairs, the floor is slippery.', 'Library', 'Ground floor', 'critical', 'resolved', staff2, 6],
    [student2, 'Furniture', 'Broken chairs in classroom', 'Five chairs in the back row are broken and unsafe to sit on.', 'Building D', '210', 'medium', 'under_review', null, 1],
    [student2, 'Security', 'Lab door lock damaged', 'The electronics lab door does not lock properly after classes.', 'Building B', '220', 'high', 'needs_information', null, 4],
    [student2, 'Network', 'Slow internet in hostel', 'Internet speed in the hostel common room is extremely slow every evening.', 'Hostel 1', 'Common room', 'medium', 'rejected', null, 9],
    [student2, 'Electrical', 'Lights flickering in library', 'Tube lights on the reading floor flicker constantly, making it hard to study.', 'Library', '1st floor', 'medium', 'closed', staff1, 20],
  ];

  const paths = {
    submitted: [],
    under_review: ['under_review'],
    needs_information: ['under_review', 'needs_information'],
    rejected: ['rejected'],
    assigned: ['under_review', 'assigned'],
    in_progress: ['under_review', 'assigned', 'in_progress'],
    resolved: ['under_review', 'assigned', 'in_progress', 'resolved'],
    closed: ['under_review', 'assigned', 'in_progress', 'resolved', 'closed'],
  };
  const notes = {
    under_review: 'Reviewed by admin',
    needs_information: 'Please share a photo of the damaged lock and the exact time you noticed it.',
    rejected: 'Hostel network is managed by an external ISP. Please contact the hostel office.',
    in_progress: 'Started working on the issue',
    resolved: 'Issue fixed and verified on site.',
    closed: 'Student confirmed the resolution',
  };

  const year = new Date().getFullYear();
  let seq = 0;
  for (const [owner, cat, title, description, building, room, priority, finalStatus, staff, daysAgo] of samples) {
    seq += 1;
    const created = ago(daysAgo, 5);
    const complaint = await Complaint.create({
      trackingCode: `CMP-${year}-${String(seq).padStart(4, '0')}`,
      student: owner._id,
      category: cats[cat]._id,
      title,
      description,
      location: { building, room },
      priority,
      status: finalStatus,
      assignedStaff: staff?._id || null,
      resolutionNote: ['resolved', 'closed'].includes(finalStatus) ? notes.resolved : '',
      rejectionReason: finalStatus === 'rejected' ? notes.rejected : '',
      createdAt: created,
    });

    const history = [{ changedBy: owner._id, oldStatus: null, newStatus: 'submitted', note: 'Complaint submitted', createdAt: created }];
    let prev = 'submitted';
    let t = created.getTime();
    for (const next of paths[finalStatus]) {
      t += (daysAgo > 1 ? 8 : 1) * 36e5;
      const actor = next === 'in_progress' || next === 'resolved' ? staff : next === 'closed' ? owner : admin;
      const note = next === 'assigned' ? `Assigned to ${staff.name}` : notes[next] || '';
      history.push({ changedBy: actor._id, oldStatus: prev, newStatus: next, note, createdAt: new Date(t) });
      if (next === 'resolved') complaint.resolvedAt = new Date(t);
      if (next === 'closed') complaint.closedAt = new Date(t);
      prev = next;
    }
    await ComplaintStatusHistory.insertMany(history.map((h) => ({ ...h, complaint: complaint._id, type: 'status' })));
    complaint.updatedAt = new Date(t);
    await complaint.save({ timestamps: false });

    if (finalStatus === 'closed') {
      await Feedback.create({
        complaint: complaint._id,
        student: owner._id,
        rating: seq < 5 ? 5 : 4,
        comment: seq < 5 ? 'Quick and professional work. Thank you!' : 'Fixed well, took a little longer than expected.',
      });
    }
  }
  await Counter.findOneAndUpdate({ _id: `complaint-${year}` }, { seq }, { upsert: true });

  await Notification.insertMany([
    { user: student._id, title: 'Welcome to Smart Campus', message: 'Report campus issues and track their progress here.' },
    { user: staff1._id, title: 'You have new assignments', message: 'Check your dashboard for assigned complaints.' },
  ]);

  return { admin, staff1, staff2, student, student2 };
}

async function seedIfEmpty() {
  if (await User.exists({})) return false;
  await seed();
  console.log('Demo data created:');
  console.log(`  Admin   -> ${process.env.SEED_ADMIN_EMAIL || 'admin@campus.edu'} / ${process.env.SEED_ADMIN_PASSWORD ? '(from env)' : DEMO_PASSWORDS.admin}`);
  console.log(`  Staff   -> staff@campus.edu / ${DEMO_PASSWORDS.staff}`);
  console.log(`  Student -> student@campus.edu / ${DEMO_PASSWORDS.student}`);
  return true;
}

async function reset() {
  await Promise.all(
    [User, Category, Complaint, ComplaintStatusHistory, Feedback, Counter, Attachment, Notification].map((m) => m.deleteMany({}))
  );
}

module.exports = { seed, seedIfEmpty, reset, DEMO_PASSWORDS };

if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/db');
  (async () => {
    await connectDB();
    if (process.argv.includes('--reset')) {
      await reset();
      console.log('Database cleared.');
    }
    const seeded = await seedIfEmpty();
    if (!seeded) console.log('Database already has users. Use "npm run seed -- --reset" to start fresh.');
    await disconnectDB();
  })().catch(async (err) => {
    console.error(err);
    await disconnectDB();
    process.exit(1);
  });
}
