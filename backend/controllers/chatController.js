const { Message } = require('../models');
const { sendSuccess } = require('../utils/response');
const { loadAccessibleComplaint } = require('../utils/access');
const realtime = require('../utils/realtime');
const notify = require('../utils/notify');

const SENDER_FIELDS = 'name role';

// On anonymous complaints only admins (and the student) see who the student is.
const mask = (complaint, viewer, m) =>
  complaint.isAnonymous && !['admin', 'student'].includes(viewer.role) && m.sender?.role === 'student'
    ? { ...m, sender: { ...m.sender, name: 'Anonymous student' } }
    : m;

// GET /api/complaints/:id/messages — chat history; marks messages as read
exports.list = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const messages = await Message.find({ complaint: complaint._id })
    .sort({ createdAt: 1 })
    .limit(500)
    .populate('sender', SENDER_FIELDS)
    .lean();
  await Message.updateMany({ complaint: complaint._id, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
  sendSuccess(res, { data: messages.map((m) => mask(complaint, req.user, m)) });
};

// POST /api/complaints/:id/messages
exports.send = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const created = await Message.create({ complaint: complaint._id, sender: req.user._id, text: req.body.text, readBy: [req.user._id] });
  const message = await created.populate('sender', SENDER_FIELDS);
  const payload = message.toObject();

  // The live broadcast reaches staff too, so it is masked for everyone.
  realtime.toComplaint(complaint._id, 'chat:message', mask(complaint, { role: 'staff' }, payload));

  // Participants who are offline get a regular notification instead.
  const others = [complaint.student, complaint.assignedStaff].filter((id) => id && String(id) !== String(req.user._id));
  const offline = others.filter((id) => !realtime.isOnline(id));
  await notify(offline, {
    email: 'chatMessages',
    title: `New message on ${complaint.trackingCode}`,
    message: `${req.user.name}: ${req.body.text.slice(0, 150)}`,
    complaint,
  });

  sendSuccess(res, { status: 201, message: 'Message sent', data: payload });
};
