/**
 * Demo data: categories, admin/staff/student accounts and sample complaints.
 *   npm run seed            -> seed only if the database is empty
 *   npm run seed -- --reset -> wipe all collections and reseed
 * Admin credentials can be overridden with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
const { User, Category, Complaint, ComplaintStatusHistory, Feedback, Counter, Attachment, Notification, Department, Session, AuthToken, AuditLog, Message, SlaPolicy, Location, JobRun, Asset, SparePart, StockMovement, WorkOrder, Setting, Vote } = require('../models');
const { computeDueDates } = require('./sla');
const university = require('../config/university');

const DEMO_PASSWORDS = { admin: 'Admin@123', staff: 'Staff@123', student: 'Student@123', dept_head: 'Head@123' };

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

/*
 * Sample campus layout for the engineering faculty. Building names and positions are
 * placeholders around the IUBAT campus centre — admins can rename/move them in the app.
 * [name, code, department, [lat offset, lng offset], { floorName: [rooms] }]
 */
const CAMPUS = [
  ['Main Academic Building', 'MAB', 'EEE', [0.0004, -0.0006], {
    '2nd floor': ['Room 210', 'Room 215'],
    '4th floor': ['Room 405', 'Room 410', 'Seminar Hall'],
  }],
  ['Engineering Building', 'ENG', 'CSE', [-0.0003, 0.0005], {
    '2nd floor': ['CSE Lab 1', 'CSE Lab 3', 'Networking Lab'],
    '3rd floor': ['EEE Electronics Lab', 'EEE Power Lab', '3rd floor washroom'],
    '4th floor': ['Civil Materials Lab', 'Surveying Lab'],
  }],
  ['Engineering Workshop', 'WKS', 'ME', [-0.0009, -0.0002], {
    'Ground floor': ['ME Workshop', 'Machine Shop', 'Welding Bay'],
  }],
  ['Central Library', 'LIB', '', [0.0009, 0.0003], {
    'Ground floor': ['Circulation Desk', 'Ground floor'],
    '1st floor': ['Reading Room', '1st floor'],
  }],
  ['Study Arena & Open Auditorium', 'ARENA', '', [0.0001, 0.0012], {}],
  ['Central Cafeteria', 'CAF', '', [-0.0006, -0.0011], {}],
];

async function seedLocations() {
  const { lat, lng } = university.location;
  const places = {};
  for (const [name, code, department, [dLat, dLng], floors] of CAMPUS) {
    const b = await Location.create({ name, code, type: 'building', department, geo: { lat: lat + dLat, lng: lng + dLng } });
    places[name] = { _id: b._id, rooms: {} };
    let f = 0;
    for (const [floorName, rooms] of Object.entries(floors)) {
      f += 1;
      const floor = await Location.create({ name: floorName, code: `${code}-F${f}`, type: 'floor', parent: b._id, building: b._id, department });
      let r = 0;
      for (const room of rooms) {
        r += 1;
        const doc = await Location.create({ name: room, code: `${code}-${f}${String(r).padStart(2, '0')}`, type: 'room', parent: floor._id, building: b._id, department });
        places[name].rooms[room] = doc._id;
      }
    }
  }
  return places;
}

const day = 24 * 60 * 60 * 1000;
const ago = (days, hours = 0) => new Date(Date.now() - days * day - hours * 36e5);

async function makeUser(data, password) {
  const user = new User({ emailVerified: true, ...data });
  await user.setPassword(password);
  return user.save();
}

async function seed() {
  await Department.insertMany(university.departments);
  const places = await seedLocations();
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
  const cseHead = await makeUser(
    { name: 'Dr. Farhana Islam', email: `cse.head@${DOMAIN}`, role: 'dept_head', department: 'CSE', phone: '+8801700000010' },
    DEMO_PASSWORDS.dept_head
  );
  await makeUser(
    { name: 'Dr. Mahbub Alam', email: `eee.head@${DOMAIN}`, role: 'dept_head', department: 'EEE', phone: '+8801700000011' },
    DEMO_PASSWORDS.dept_head
  );

  // Staff work profiles for smart assignment.
  const bld = (name) => places[name]._id;
  staff1.staffProfile = {
    skills: ['Electrical', 'Network & IT', 'Lab Equipment', 'AC & Ventilation'].map((c) => cats[c]._id),
    zones: [bld('Engineering Building'), bld('Main Academic Building')],
    maxOpenTasks: 6,
  };
  staff2.staffProfile = {
    skills: ['Plumbing', 'Cleaning', 'Furniture', 'Safety & Security'].map((c) => cats[c]._id),
    zones: [bld('Central Library'), bld('Engineering Workshop'), bld('Central Cafeteria')],
    maxOpenTasks: 6,
  };
  await Promise.all([staff1.save(), staff2.save()]);
  // Cleaning requests are routed automatically.
  await Category.updateOne({ _id: cats.Cleaning._id }, { autoAssign: true });

  // Assets [code, name, type, category, building, room, serial, purchased (months ago), warranty months]
  const ASSETS = [
    ['AST-OSC-04', 'Oscilloscope (Bench 4)', 'Oscilloscope', 'Lab Equipment', 'Engineering Building', 'EEE Electronics Lab', 'TDS-2024-8841', 30, 36],
    ['AST-RTR-L3', 'Lab router — CSE Lab 3', 'Network router', 'Network & IT', 'Engineering Building', 'CSE Lab 3', 'RB4011-77A2', 14, 24],
    ['AST-AC-SEM', 'Seminar Hall AC (2.5 ton)', 'Air conditioner', 'AC & Ventilation', 'Main Academic Building', 'Seminar Hall', 'GREE-25T-3310', 40, 24],
    ['AST-FAN-405', 'Ceiling fan — Room 405', 'Ceiling fan', 'Electrical', 'Main Academic Building', 'Room 405', '', 60, 12],
    ['AST-LATHE-1', 'Lathe machine #1', 'Lathe', 'Lab Equipment', 'Engineering Workshop', 'ME Workshop', 'LT-1990-12', 72, 0],
    ['AST-PRJ-210', 'Projector — Room 210', 'Projector', 'Network & IT', 'Main Academic Building', 'Room 210', 'EPS-X49-0021', 20, 24],
  ];
  const assets = {};
  for (const [code, name, type, cat, building, room, serialNo, ageMonths, warrantyMonths] of ASSETS) {
    const location = places[building].rooms[room] || places[building]._id;
    const loc = await Location.findById(location).populate('building', 'department');
    const purchaseDate = new Date(Date.now() - ageMonths * 30 * day);
    assets[code] = await Asset.create({
      code, name, type, serialNo, location, category: cats[cat]._id,
      department: loc.department || loc.building?.department || '',
      purchaseDate,
      warrantyUntil: warrantyMonths ? new Date(purchaseDate.getTime() + warrantyMonths * 30 * day) : undefined,
    });
  }

  // Spare parts [sku, name, unit, qty, min, unit cost BDT]
  const PARTS = [
    ['CAP-25UF', 'Fan capacitor 2.5µF', 'pcs', 24, 10, 120],
    ['LED-TUBE-20W', 'LED tube light 20W', 'pcs', 6, 10, 450],
    ['CAT6-M', 'Cat6 network cable', 'm', 180, 50, 35],
    ['RJ45', 'RJ45 connector', 'pcs', 90, 40, 15],
    ['TAP-BRASS', 'Brass water tap', 'pcs', 8, 4, 650],
    ['AC-GAS-R32', 'AC refrigerant R32', 'kg', 3, 2, 2200],
    ['PROBE-X10', 'Oscilloscope probe x10', 'pcs', 2, 2, 1800],
    ['FUSE-10A', 'Fuse 10A', 'pcs', 40, 20, 25],
  ];
  const parts = {};
  for (const [sku, name, unit, quantity, minQuantity, unitCost] of PARTS) {
    parts[sku] = await SparePart.create({ sku, name, unit, quantity, minQuantity, unitCost, supplier: 'Uttara Electric Supply' });
    await StockMovement.create({ part: parts[sku]._id, type: 'in', quantity, unitCost, by: admin._id, note: 'Opening stock' });
  }

  const student2 = await makeUser(
    { name: 'Tanvir Ahmed', email: `student2@${DOMAIN}`, studentId: '22205014', role: 'student', department: 'EEE' },
    DEMO_PASSWORDS.student
  );

  // [student, category, title, description, building, room, priority, final status, staff, days ago]
  const samples = [
    [student, 'Network & IT', 'Lab Wi-Fi is not working', 'Several computers in the CSE software lab cannot connect to the internet since Monday morning.', 'Engineering Building', 'CSE Lab 3', 'high', 'in_progress', staff1, 3, 'AST-RTR-L3'],
    [student, 'Electrical', 'Broken classroom fan', 'The ceiling fan near the window makes a loud noise and stops frequently during class.', 'Main Academic Building', 'Room 405', 'medium', 'assigned', staff1, 2, 'AST-FAN-405'],
    [student, 'Cleaning', 'Washroom needs cleaning', 'The third floor washroom has not been cleaned for two days and has no soap.', 'Engineering Building', '3rd floor washroom', 'low', 'closed', staff2, 12],
    [student, 'Lab Equipment', 'Oscilloscope not powering on', 'Bench 4 oscilloscope in the electronics lab does not turn on, lab work is blocked.', 'Engineering Building', 'EEE Electronics Lab', 'high', 'submitted', null, 0, 'AST-OSC-04'],
    [student, 'Plumbing', 'Water leakage in corridor', 'Water is leaking from the ceiling near the stairs, the floor is slippery.', 'Central Library', 'Ground floor', 'critical', 'resolved', staff2, 6],
    [student2, 'Furniture', 'Broken chairs in classroom', 'Five chairs in the back row are broken and unsafe to sit on.', 'Main Academic Building', 'Room 210', 'medium', 'under_review', null, 1],
    [student2, 'Safety & Security', 'Workshop door lock damaged', 'The mechanical workshop door does not lock properly after classes.', 'Engineering Workshop', 'ME Workshop', 'high', 'needs_information', null, 4],
    [student2, 'AC & Ventilation', 'AC not cooling in seminar room', 'The air conditioner runs but blows warm air; the room gets very hot during seminars.', 'Main Academic Building', 'Seminar Hall', 'medium', 'rejected', null, 9, 'AST-AC-SEM'],
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
  for (const [owner, cat, title, description, building, room, priority, finalStatus, staff, daysAgo, assetCode] of samples) {
    seq += 1;
    const created = ago(daysAgo, 5);
    const place = places[building]?.rooms[room] || places[building]?._id || null;
    const placeDoc = place ? await Location.findById(place).populate('building', 'department') : null;
    const complaint = await Complaint.create({
      sla: await computeDueDates(created, priority, cats[cat]._id),
      trackingCode: `CMP-${year}-${String(seq).padStart(4, '0')}`,
      student: owner._id,
      category: cats[cat]._id,
      title,
      description,
      location: { building, room, place },
      department: placeDoc?.department || placeDoc?.building?.department || owner.department,
      asset: assetCode ? assets[assetCode]._id : null,
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
      if (!complaint.sla.firstResponseAt) complaint.sla.firstResponseAt = new Date(t);
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

  // student2 is affected by student's Wi-Fi problem too.
  const wifiVote = await Complaint.findOne({ asset: assets['AST-RTR-L3']._id });
  await Vote.create({ complaint: wifiVote._id, user: student2._id });
  await Complaint.updateOne({ _id: wifiVote._id }, { votes: 1 });

  // Repair records on the router complaint: parts used and a work order awaiting the CSE head.
  const wifi = await Complaint.findOne({ asset: assets['AST-RTR-L3']._id });
  for (const [sku, qty] of [['CAT6-M', 20], ['RJ45', 8]]) {
    const p = parts[sku];
    await SparePart.updateOne({ _id: p._id }, { $inc: { quantity: -qty } });
    await StockMovement.create({ part: p._id, type: 'out', quantity: -qty, unitCost: p.unitCost, complaint: wifi._id, by: staff1._id });
    wifi.cost.parts += qty * p.unitCost;
  }
  await wifi.save({ timestamps: false });
  await WorkOrder.create({
    complaint: wifi._id,
    department: wifi.department,
    createdBy: staff1._id,
    description: 'Replace the faulty 24-port lab switch (MikroTik CRS326)',
    estimatedCost: 18500,
    requiredApprovals: ['dept_head'],
  });
  await Notification.create({ user: cseHead._id, title: `Approval needed: ${wifi.trackingCode}`, message: 'Rahim Uddin requests ৳18,500 — replace the faulty lab switch.', complaint: wifi._id });

  await Notification.insertMany([
    { user: student._id, title: `Welcome to ${university.shortName} Smart Campus`, message: 'Report campus issues and track their progress here.' },
    { user: staff1._id, title: 'You have new assignments', message: 'Check your dashboard for assigned complaints.' },
  ]);

  return { admin, staff1, staff2, student, student2, cseHead, assets, parts };
}

async function seedIfEmpty() {
  if (await User.exists({})) return false;
  await seed();
  console.log('Demo data created:');
  console.log(`  Admin   -> ${process.env.SEED_ADMIN_EMAIL || `admin@${DOMAIN}`} / ${process.env.SEED_ADMIN_PASSWORD ? '(from env)' : DEMO_PASSWORDS.admin}`);
  console.log(`  Staff   -> staff@${DOMAIN} / ${DEMO_PASSWORDS.staff}`);
  console.log(`  Student -> student@${DOMAIN} / ${DEMO_PASSWORDS.student}`);
  console.log(`  Dept head -> cse.head@${DOMAIN} / ${DEMO_PASSWORDS.dept_head}`);
  return true;
}

async function reset() {
  await Promise.all(
    [User, Category, Complaint, ComplaintStatusHistory, Feedback, Counter, Attachment, Notification, Department, Session, AuthToken, AuditLog, Message, SlaPolicy, Location, JobRun, Asset, SparePart, StockMovement, WorkOrder, Setting, Vote].map((m) => m.deleteMany({}))
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
