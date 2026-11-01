const config = require('../config/env');
const { withTransaction } = require('../config/db');
const { Complaint, Category, ComplaintStatusHistory, Attachment, Feedback, User } = require('../models');
const ApiError = require('../utils/ApiError');
const notify = require('../utils/notify');
const realtime = require('../utils/realtime');
const { sendSuccess } = require('../utils/response');
const { verifyImages, saveImages, filePath } = require('../utils/fileStorage');
const { generateTrackingCode, changeStatus, addNote } = require('../utils/complaintService');
const { listComplaints, statusCounts } = require('../utils/complaintQuery');
const { allowedNextStatuses, STATUS_LABELS } = require('../utils/workflow');
const { computeDueDates, slaUpdateFor } = require('../utils/sla');
const { resolvePlace } = require('../utils/locations');
const { loadAccessibleComplaint, isOwner, isAssignedStaff, assertObjectId, canAccessComplaint } = require('../utils/access');

const EDITABLE_STATUSES = ['submitted', 'needs_information'];
const UPLOAD_CLOSED_STATUSES = ['closed', 'rejected'];

async function getActiveCategory(id) {
  const category = await Category.findById(id);
  if (!category || !category.isActive) throw ApiError.badRequest('Please choose an active category');
  return category;
}

async function notifyAdmins(payload) {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  await notify(admins.map((a) => a._id), payload);
}

/** What the current user may do with this complaint — drives the UI buttons. */
function permissionsFor(user, complaint, hasFeedback) {
  const owner = isOwner(user, complaint);
  const admin = user.role === 'admin';
  const staff = isAssignedStaff(user, complaint);
  const status = complaint.status;
  return {
    nextStatuses: allowedNextStatuses(status, user.role).filter((s) => {
      if (s === 'assigned') return false; // via the assignment action
      if (user.role === 'student') return owner && s === 'closed';
      if (user.role === 'staff') return staff;
      return admin;
    }),
    canEdit: owner && EDITABLE_STATUSES.includes(status),
    canUpload: (owner || staff || admin) && !UPLOAD_CLOSED_STATUSES.includes(status),
    canAddNote: owner || staff || admin,
    canAssign: admin && ['submitted', 'under_review', 'assigned', 'in_progress'].includes(status),
    canChangePriority: admin && !['closed', 'rejected'].includes(status),
    canFeedback: owner && ['resolved', 'closed'].includes(status) && !hasFeedback,
    canClose: owner && status === 'resolved',
    canRequestReopen: owner && ['resolved', 'closed'].includes(status) && !complaint.reopenRequest?.requested,
  };
}

// POST /api/complaints  (multipart: fields + optional `images`)
exports.create = async (req, res) => {
  const { title, description, category, priority = 'medium' } = req.body;
  await getActiveCategory(category);
  verifyImages(req.files); // reject bad files before anything is written
  // A picked or scanned location fills in the building/room names.
  const location = await resolvePlace(req.body);
  const createdAt = new Date();
  const due = await computeDueDates(createdAt, priority, category);

  const complaint = await withTransaction(async (session) => {
    const trackingCode = await generateTrackingCode(session);
    const [created] = await Complaint.create(
      [
        {
          trackingCode,
          student: req.user._id,
          category,
          title,
          description,
          location,
          priority,
          status: 'submitted',
          sla: due,
          createdAt,
        },
      ],
      { session }
    );
    await ComplaintStatusHistory.create(
      [{ complaint: created._id, changedBy: req.user._id, type: 'status', oldStatus: null, newStatus: 'submitted', note: 'Complaint submitted' }],
      { session }
    );
    return created;
  });

  const attachments = await saveImages(req.files, { complaintId: complaint._id, userId: req.user._id });

  realtime.toRole('admin', 'complaint:new', { id: String(complaint._id), trackingCode: complaint.trackingCode });
  await notifyAdmins({
    title: `New complaint ${complaint.trackingCode}`,
    message: `${complaint.title} — ${complaint.priority} priority`,
    complaint,
  });

  sendSuccess(res, {
    status: 201,
    message: 'Complaint created successfully',
    data: {
      id: complaint._id,
      trackingCode: complaint.trackingCode,
      status: complaint.status,
      attachments: attachments.length,
    },
  });
};

// GET /api/complaints/my
exports.listMine = async (req, res) => {
  const { items, meta } = await listComplaints(req.query, { student: req.user._id });
  sendSuccess(res, { data: items, meta });
};

// GET /api/complaints/my/stats
exports.myStats = async (req, res) => {
  const counts = await statusCounts({ student: req.user._id });
  const recent = await Complaint.find({ student: req.user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('category', 'name')
    .select('trackingCode title category priority status createdAt')
    .lean();
  sendSuccess(res, { data: { counts, recent } });
};

// GET /api/complaints/track/:code — look up one of my complaints by tracking code
exports.track = async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const complaint = await Complaint.findOne({ trackingCode: code }).select('_id student assignedStaff trackingCode status');
  if (!complaint || !canAccessComplaint(req.user, complaint)) {
    throw ApiError.notFound('No complaint with that tracking code was found in your account');
  }
  sendSuccess(res, { data: { id: complaint._id, trackingCode: complaint.trackingCode, status: complaint.status } });
};

// GET /api/complaints/:id
exports.getById = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const isStudent = req.user.role === 'student';

  const studentFields = req.user.role === 'admin' ? 'name email studentId department phone' : 'name department';
  await complaint.populate([
    { path: 'category', select: 'name isActive' },
    { path: 'student', select: studentFields },
    { path: 'assignedStaff', select: isStudent ? 'name department' : 'name email department phone' },
  ]);

  const historyFilter = { complaint: complaint._id };
  if (isStudent) historyFilter.internal = { $ne: true };

  const [history, attachments, feedback] = await Promise.all([
    ComplaintStatusHistory.find(historyFilter).sort({ createdAt: 1 }).populate('changedBy', 'name role').lean(),
    Attachment.find({ complaint: complaint._id }).sort({ createdAt: 1 }).populate('uploadedBy', 'name role').lean(),
    Feedback.findOne({ complaint: complaint._id }).lean(),
  ]);

  sendSuccess(res, {
    data: {
      complaint: complaint.toObject({ versionKey: false }),
      history,
      attachments: attachments.map(({ storageKey, ...a }) => a),
      feedback,
      permissions: permissionsFor(req.user, complaint, Boolean(feedback)),
    },
  });
};

// PATCH /api/complaints/:id — owner edits descriptive fields while still editable
exports.update = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (!isOwner(req.user, complaint)) throw ApiError.forbidden('Only the complaint owner can edit it');
  if (!EDITABLE_STATUSES.includes(complaint.status)) {
    throw ApiError.badRequest(`A complaint that is ${STATUS_LABELS[complaint.status]} can no longer be edited`);
  }

  const { title, description, category, building, room, priority } = req.body;
  if (category && String(category) !== String(complaint.category)) await getActiveCategory(category);

  if ((priority && priority !== complaint.priority) || (category && String(category) !== String(complaint.category))) {
    const sla = await slaUpdateFor(complaint, { priority: priority || complaint.priority, category: category || complaint.category });
    for (const [k, v] of Object.entries(sla)) complaint.set(k, v);
  }
  if (title !== undefined) complaint.title = title;
  if (description !== undefined) complaint.description = description;
  if (category !== undefined) complaint.category = category;
  if (building !== undefined) complaint.location.building = building;
  if (room !== undefined) complaint.location.room = room;
  if (priority !== undefined) complaint.priority = priority;
  await complaint.save();

  let updated = complaint;
  // Providing requested information sends the complaint back for review.
  if (complaint.status === 'needs_information') {
    updated = await changeStatus({
      complaint,
      actor: req.user,
      newStatus: 'under_review',
      note: req.body.note?.trim() || 'Student updated the complaint with more information',
    });
  }

  sendSuccess(res, { message: 'Complaint updated', data: { id: updated._id, status: updated.status } });
};

// POST /api/complaints/:id/attachments
exports.uploadAttachments = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (UPLOAD_CLOSED_STATUSES.includes(complaint.status)) {
    throw ApiError.badRequest(`Attachments cannot be added to a ${STATUS_LABELS[complaint.status]} complaint`);
  }
  if (!req.files?.length) throw ApiError.badRequest('Please select at least one image');

  const existing = await Attachment.countDocuments({ complaint: complaint._id });
  if (existing + req.files.length > config.maxAttachmentsPerComplaint) {
    throw ApiError.badRequest(`A complaint can have at most ${config.maxAttachmentsPerComplaint} attachments`);
  }

  const purpose = req.user.role === 'student' ? 'evidence' : 'resolution';
  const saved = await saveImages(req.files, { complaintId: complaint._id, userId: req.user._id, purpose });
  realtime.toComplaint(complaint._id, 'complaint:updated', { id: String(complaint._id), status: complaint.status });
  sendSuccess(res, {
    status: 201,
    message: `${saved.length} image(s) uploaded`,
    data: saved.map((a) => ({ _id: a._id, fileUrl: a.fileUrl, mimeType: a.mimeType, sizeBytes: a.sizeBytes, purpose })),
  });
};

// GET /api/attachments/:id/file — streams an image to authorized users only
exports.downloadAttachment = async (req, res) => {
  assertObjectId(req.params.id, 'attachment id');
  const attachment = await Attachment.findById(req.params.id);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  await loadAccessibleComplaint(attachment.complaint, req.user);

  res.set({
    'Content-Type': attachment.mimeType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
    'Content-Disposition': 'inline',
  });
  res.sendFile(filePath(attachment.storageKey), (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'File not found' });
  });
};

// POST /api/complaints/:id/notes — progress update or internal remark
exports.addNote = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  const internal = req.user.role !== 'student' && Boolean(req.body.internal);
  const entry = await addNote({ complaint, actor: req.user, note: req.body.note, internal });
  if (req.user.role === 'student' && complaint.assignedStaff) {
    await notify([complaint.assignedStaff], {
      title: `Student comment on ${complaint.trackingCode}`,
      message: req.body.note.slice(0, 200),
      complaint,
    });
  }
  sendSuccess(res, { status: 201, message: 'Note added', data: entry });
};

// POST /api/complaints/:id/close — student confirms the resolution
exports.close = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (!isOwner(req.user, complaint)) throw ApiError.forbidden('Only the complaint owner can confirm the resolution');
  const updated = await changeStatus({
    complaint,
    actor: req.user,
    newStatus: 'closed',
    note: req.body.note?.trim() || 'Student confirmed the resolution',
  });
  sendSuccess(res, { message: 'Complaint closed. Thank you!', data: { id: updated._id, status: updated.status } });
};

// POST /api/complaints/:id/reopen-request — student asks the admin to reopen
exports.requestReopen = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (!isOwner(req.user, complaint)) throw ApiError.forbidden('Only the complaint owner can request a reopen');
  if (!['resolved', 'closed'].includes(complaint.status)) {
    throw ApiError.badRequest('Only resolved or closed complaints can be reopened');
  }
  if (complaint.reopenRequest?.requested) throw ApiError.conflict('A reopen request is already pending');

  complaint.reopenRequest = { requested: true, reason: req.body.reason, requestedAt: new Date() };
  await complaint.save();
  await ComplaintStatusHistory.create({
    complaint: complaint._id,
    changedBy: req.user._id,
    type: 'note',
    oldStatus: complaint.status,
    newStatus: complaint.status,
    note: `Reopen requested: ${req.body.reason}`,
  });
  await notifyAdmins({
    title: `Reopen requested for ${complaint.trackingCode}`,
    message: req.body.reason.slice(0, 200),
    complaint,
  });
  realtime.toComplaint(complaint._id, 'complaint:updated', { id: String(complaint._id), status: complaint.status });
  sendSuccess(res, { message: 'Reopen request sent to the administrator' });
};

// POST /api/complaints/:id/feedback
exports.submitFeedback = async (req, res) => {
  const complaint = await loadAccessibleComplaint(req.params.id, req.user);
  if (!isOwner(req.user, complaint)) throw ApiError.forbidden('Only the complaint owner can give feedback');
  if (!['resolved', 'closed'].includes(complaint.status)) {
    throw ApiError.badRequest('Feedback can be given only after the complaint is resolved');
  }
  if (await Feedback.exists({ complaint: complaint._id })) {
    throw ApiError.conflict('Feedback has already been submitted for this complaint');
  }

  const feedback = await Feedback.create({
    complaint: complaint._id,
    student: req.user._id,
    rating: req.body.rating,
    comment: req.body.comment || '',
  });
  if (complaint.assignedStaff) {
    await notify([complaint.assignedStaff], {
      title: `Feedback received for ${complaint.trackingCode}`,
      message: `Rated ${feedback.rating}/5${feedback.comment ? ` — ${feedback.comment.slice(0, 150)}` : ''}`,
      complaint,
    });
  }
  realtime.toComplaint(complaint._id, 'complaint:updated', { id: String(complaint._id), status: complaint.status });
  sendSuccess(res, { status: 201, message: 'Thank you for your feedback!', data: feedback });
};
