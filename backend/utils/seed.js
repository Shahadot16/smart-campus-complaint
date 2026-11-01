/**
 * Demo data: categories, admin/staff/student accounts and sample complaints.
 *   npm run seed            -> seed only if the database is empty
 *   npm run seed -- --reset -> wipe all collections and reseed
 * Admin credentials can be overridden with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
const { User, Category, Complaint, ComplaintStatusHistory, Feedback, Counter, Attachment, Notification, Department, Session, AuthToken, AuditLog, Message } = require('../models');
const university = require('../config/university');

const DEMO_PASSWORDS = { admin: 'Admin@123', staff: 'Staff@123', student: 'Student@123' };

const CATEGORIES = [
  ['Network & IT', 'Wi-Fi, LAN, internet, lab computers and software'],
  ['Electrical', 'Lights, fans, sockets, power supply and generators'],
  ['Lab Equipment', 'Engineering lab machines, instruments and test benches'],
  ['AC & Ventilation', 'Air conditioners, exhaust fans and ventilation'],
  ['Plumbing', 'Water supply, taps, drains and leakages'],
  ['Cleaning', 'Washrooms, classrooms, labs and common areas'],
  ['Furniture', 'Desks, chairs, whiteboards and lab benches'],
  ['Safety & Security', 'Doors, locks, CCTV, fire safety and hazards'],
];

const DOMAIN = university.emailDomain;

const day = 24 * 60 * 60 * 1000;
const ago = (days, hours = 0) => new Date(Date.now() - days * day - hours * 36e5);

async function makeUser(data, password) {
  const user = new User({ emailVerified: true, ...data });
  await user.setPassword(password);
  return user.save();
}

async function seed() {
  await Department.insertMany(university.departments);
  const cats = Object.fromEntries(
    (await Category.insertMany(CATEGORIES.map(([name, description]) => ({ name, description })))).map((c) => [c.name, c])
  );

  const admin = await makeUser(
    { name: 'Facilities Admin', email: process.env.SEED_ADMIN_EMAIL || `admin@${DOMAIN}`, role: 'admin', department: 'Facilities Office' },
    process.env.SEED_ADMIN_PASSWORD || DEMO_PASSWORDS.admin
  );
  const staff1 = await makeUser(
    { name: 'Rahim Uddin', email: `staff@${DOMAIN}`, role: 'staff', department: 'Electrical & IT Maintenance', phone: '+8801700000001' },
    DEMO_PASSWORDS.staff
  );
  const staff2 = await makeUser(
    { name: 'Karim Hossain', email: `staff2@${DOMAIN}`, role: 'staff', department: 'Civil & Plumbing Maintenance', phone: '+8801700000002' },
    DEMO_PASSWORDS.staff
  );
  const student = await makeUser(
    { name: 'Nusrat Jahan', email: `student@${DOMAIN}`, studentId: '22103001', role: 'student', department: 'CSE' },
    DEMO_PASSWORDS.student
  );
  const student2 = await makeUser(
    { name: 'Tanvir Ahmed', email: `student2@${DOMAIN}`, studentId: '22205014', role: 'student', department: 'EEE' },
    DEMO_PASSWORDS.student
  );

  // [student, category, title, description, building, room, priority, final status, staff, days ago]
  const samples = [
    [student, 'Network & IT', 'Lab Wi-Fi is not working', 'Several computers in the CSE software lab cannot connect to the internet since Monday morning.', 'Engineering Building', 'CSE Lab 3', 'high', 'in_progress', staff1, 3],
    [student, 'Electrical', 'Broken classroom fan', 'The ceiling fan near the window makes a loud noise and stops frequently during class.', 'Main Academic Building', 'Room 405', 'medium', 'assigned', staff1, 2],
    [student, 'Cleaning', 'Washroom needs cleaning', 'The third floor washroom has not been cleaned for two days and has no soap.', 'Engineering Building', '3rd floor washroom', 'low', 'closed', staff2, 12],
    [student, 'Lab Equipment', 'Oscilloscope not powering on', 'Bench 4 oscilloscope in the electronics lab does not turn on, lab work is blocked.', 'Engineering Building', 'EEE Electronics Lab', 'high', 'submitted', null, 0],
    [student, 'Plumbing', 'Water leakage in corridor', 'Water is leaking from the ceiling near the stairs, the floor is slippery.', 'Central Library', 'Ground floor', 'critical', 'resolved', staff2, 6],
    [student2, 'Furniture', 'Broken chairs in classroom', 'Five chairs in the back row are broken and unsafe to sit on.', 'Main Academic Building', 'Room 210', 'medium', 'under_review', null, 1],
    [student2, 'Safety & Security', 'Workshop door lock damaged', 'The mechanical workshop door does not lock properly after classes.', 'Engineering Workshop', 'ME Workshop', 'high', 'needs_information', null, 4],
    [student2, 'AC & Ventilation', 'AC not cooling in seminar room', 'The air conditioner runs but blows warm air; the room gets very hot during seminars.', 'Main Academic Building', 'Seminar Hall', 'medium', 'rejected', null, 9],
    [student2, 'Electrical', 'Lights flickering in library', 'Tube lights on the reading floor flicker constantly, making it hard to study.', 'Central Library', '1st floor', 'medium', 'closed', staff1, 20],
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
    rejected: 'This AC is under the vendor maintenance contract. The vendor has been informed directly.',
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
    { user: student._id, title: `Welcome to ${university.shortName} Smart Campus`, message: 'Report campus issues and track their progress here.' },
    { user: staff1._id, title: 'You have new assignments', message: 'Check your dashboard for assigned complaints.' },
  ]);

  return { admin, staff1, staff2, student, student2 };
}

async function seedIfEmpty() {
  if (await User.exists({})) return false;
  await seed();
  console.log('Demo data created:');
  console.log(`  Admin   -> ${process.env.SEED_ADMIN_EMAIL || `admin@${DOMAIN}`} / ${process.env.SEED_ADMIN_PASSWORD ? '(from env)' : DEMO_PASSWORDS.admin}`);
  console.log(`  Staff   -> staff@${DOMAIN} / ${DEMO_PASSWORDS.staff}`);
  console.log(`  Student -> student@${DOMAIN} / ${DEMO_PASSWORDS.student}`);
  return true;
}

async function reset() {
  await Promise.all(
    [User, Category, Complaint, ComplaintStatusHistory, Feedback, Counter, Attachment, Notification, Department, Session, AuthToken, AuditLog, Message].map((m) => m.deleteMany({}))
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
