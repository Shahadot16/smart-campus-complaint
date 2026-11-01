const { Complaint, ComplaintStatusHistory, Counter, User, Asset } = require('../models');
const { withTransaction } = require('../config/db');
const ApiError = require('./ApiError');
const notify = require('./notify');
const realtime = require('./realtime');
const { slaUpdateFor } = require('./sla');
const { canTransition, NOTE_REQUIRED, STATUS_LABELS, isReopen } = require('./workflow');

/** Generates a unique, human-friendly tracking code such as CMP-2026-0001. */
async function generateTrackingCode(session) {
  const year = new Date().getFullYear();
  const seq = await Counter.next(`complaint-${year}`, session);
  return `CMP-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Writes a complaint update and its history entries as one unit.
 * With transactions, both commit or neither does. Without transactions the
 * complaint update is guarded by the expected status and reverted if the
 * history insert fails, so the two never disagree.
 */
async function commitChange(complaint, expectedStatus, set, historyEntries) {
  return withTransaction(async (session) => {
    const previous = {};
    for (const key of Object.keys(set)) previous[key] = complaint.get(key);

    const updated = await Complaint.findOneAndUpdate(
      { _id: complaint._id, status: expectedStatus },
      { $set: set },
      { returnDocument: 'after', runValidators: true, session }
    );
    if (!updated) {
      throw ApiError.conflict('This complaint was changed by someone else. Please refresh and try again.');
    }

    try {
      await ComplaintStatusHistory.insertMany(
        historyEntries.map((h) => ({ ...h, complaint: complaint._id })),
        { session }
      );
    } catch (err) {
      if (!session) {
        await Complaint.updateOne({ _id: complaint._id }, { $set: { ...previous, status: expectedStatus } });
      }
      throw err;
    }
    return updated;
  }).then((updated) => {
    // Everyone viewing the complaint refreshes it.
    realtime.toComplaint(updated._id, 'complaint:updated', { id: String(updated._id), status: updated.status });
    return updated;
  });
}

function requireNote(newStatus, note) {
  const message = NOTE_REQUIRED[newStatus];
  if (message && !note?.trim()) throw ApiError.badRequest(message);
}

/**
 * Validates and applies a status transition requested by `actor`.
 * Role/ownership checks for the complaint are done by the caller.
 */
async function changeStatus({ complaint, actor, newStatus, note = '', internal = false }) {
  const oldStatus = complaint.status;
  if (oldStatus === newStatus) throw ApiError.badRequest(`Complaint is already ${STATUS_LABELS[newStatus]}`);
  if (newStatus === 'assigned') {
    throw ApiError.badRequest('Use the assignment action to assign a staff member');
  }
  if (!canTransition(oldStatus, newStatus, actor.role)) {
    throw ApiError.badRequest(
      `Invalid status transition from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[newStatus] || newStatus}`
    );
  }
  requireNote(newStatus, note);

  const reopening = isReopen(oldStatus, newStatus);
  if (reopening && !note?.trim()) throw ApiError.badRequest('A reason is required to reopen a complaint');
  if (reopening && !complaint.assignedStaff) throw ApiError.badRequest('Assign a staff member before reopening');

  const set = { status: newStatus };
  const now = new Date();
  // The first action after submission counts as the SLA "response".
  if (!complaint.sla?.firstResponseAt) set['sla.firstResponseAt'] = now;
  if (newStatus === 'resolved') {
    set.resolutionNote = note.trim();
    set.resolvedAt = now;
    if (complaint.sla?.resolveDueAt && now > complaint.sla.resolveDueAt) set['sla.resolveBreached'] = true;
  }
  if (newStatus === 'closed') set.closedAt = now;
  if (newStatus === 'rejected') set.rejectionReason = note.trim();
  if (reopening) {
    set['reopenRequest.requested'] = false;
    set.resolvedAt = null;
    set.closedAt = null;
  }

  const updated = await commitChange(complaint, oldStatus, set, [
    { changedBy: actor._id, type: 'status', oldStatus, newStatus, note: note.trim(), internal: Boolean(internal) },
  ]);

  if (updated.asset && ['in_progress', 'resolved', 'closed'].includes(newStatus)) {
    await Asset.updateOne({ _id: updated.asset, status: { $ne: 'retired' } }, { status: newStatus === 'in_progress' ? 'under_repair' : 'operational' });
  }

  // Tell the other people involved (never the actor).
  const recipients = [updated.student, updated.assignedStaff].filter((id) => String(id) !== String(actor._id));
  await notify(recipients, {
    email: 'statusUpdates',
    title: `${updated.trackingCode} is now ${STATUS_LABELS[newStatus]}`,
    message: internal ? `Status changed to ${STATUS_LABELS[newStatus]}.` : note.trim() || `Status changed to ${STATUS_LABELS[newStatus]}.`,
    complaint: updated,
  });

  return updated;
}

/**
 * Assigns (or reassigns) an active staff member. A submitted complaint is
 * first moved to under_review so the audit trail follows the workflow.
 */
async function assignStaff({ complaint, actor = null, staffId, priority, note = '' }) {
  const actorId = actor?._id ?? null; // null = automatic assignment
  const staff = await User.findOne({ _id: staffId, role: 'staff' });
  if (!staff) throw ApiError.badRequest('Selected user is not a staff member');
  if (!staff.isActive) throw ApiError.badRequest('Selected staff member is inactive');

  const oldStatus = complaint.status;
  const assignable = ['submitted', 'under_review', 'assigned', 'in_progress'];
  if (!assignable.includes(oldStatus)) {
    throw ApiError.badRequest(`A complaint that is ${STATUS_LABELS[oldStatus]} cannot be assigned`);
  }
  if (String(complaint.assignedStaff) === String(staff._id) && (!priority || priority === complaint.priority)) {
    throw ApiError.badRequest(`${staff.name} is already assigned to this complaint`);
  }

  const history = [];
  const set = { assignedStaff: staff._id };
  if (!complaint.sla?.firstResponseAt) set['sla.firstResponseAt'] = new Date();
  let newStatus = oldStatus;

  if (oldStatus === 'submitted') {
    history.push({ changedBy: actorId, type: 'status', oldStatus, newStatus: 'under_review', note: actor ? 'Reviewed by admin' : 'Reviewed automatically' });
  }
  if (oldStatus === 'submitted' || oldStatus === 'under_review') {
    newStatus = 'assigned';
    set.status = newStatus;
    history.push({
      changedBy: actorId,
      type: 'status',
      oldStatus: 'under_review',
      newStatus,
      note: `${actor ? 'Assigned' : 'Auto-assigned'} to ${staff.name}${note.trim() ? ` — ${note.trim()}` : ''}`,
    });
  } else if (String(complaint.assignedStaff) !== String(staff._id)) {
    history.push({
      changedBy: actorId,
      type: 'assignment',
      oldStatus,
      newStatus,
      note: `Reassigned to ${staff.name}${note.trim() ? ` — ${note.trim()}` : ''}`,
      internal: true,
    });
  }

  if (priority && priority !== complaint.priority) {
    set.priority = priority;
    Object.assign(set, await slaUpdateFor(complaint, { priority }));
    history.push({
      changedBy: actorId,
      type: 'priority',
      oldStatus: newStatus,
      newStatus,
      note: `Priority changed from ${complaint.priority} to ${priority}`,
    });
  }

  if (!history.length) throw ApiError.badRequest('Nothing to update');

  const updated = await commitChange(complaint, oldStatus, set, history);

  await notify([staff._id], {
    email: 'assignments',
    title: `New assignment: ${updated.trackingCode}`,
    message: `${updated.title} (${updated.priority} priority)`,
    complaint: updated,
  });
  if (newStatus !== oldStatus) {
    await notify([updated.student], {
      email: 'statusUpdates',
      title: `${updated.trackingCode} has been assigned`,
      message: 'A maintenance staff member is now responsible for your complaint.',
      complaint: updated,
    });
  }
  return updated;
}

/** Records a note (progress update or internal remark) without changing status. */
async function addNote({ complaint, actor, note, internal = false }) {
  if (!note?.trim()) throw ApiError.badRequest('Note cannot be empty');
  const entry = await ComplaintStatusHistory.create({
    complaint: complaint._id,
    changedBy: actor._id,
    type: 'note',
    oldStatus: complaint.status,
    newStatus: complaint.status,
    note: note.trim(),
    internal: Boolean(internal),
  });
  realtime.toComplaint(complaint._id, 'complaint:updated', { id: String(complaint._id), status: complaint.status });
  if (!internal && actor.role !== 'student') {
    await notify([complaint.student], {
      title: `Update on ${complaint.trackingCode}`,
      message: note.trim().slice(0, 200),
      complaint,
    });
  }
  return entry;
}

module.exports = { generateTrackingCode, changeStatus, assignStaff, addNote, commitChange };
