/**
 * Complaint status workflow (Section 9.1 of the project documentation).
 * TRANSITIONS[from][to] = roles allowed to perform that change.
 * Moving to `assigned` is only possible through the assignment endpoint,
 * because it requires choosing an active staff member.
 */
const TRANSITIONS = Object.freeze({
  submitted: { under_review: ['admin'], rejected: ['admin'] },
  under_review: { assigned: ['admin'], needs_information: ['admin'], rejected: ['admin'] },
  needs_information: { under_review: ['admin', 'student'], rejected: ['admin'] },
  assigned: { in_progress: ['staff'] },
  in_progress: { resolved: ['staff', 'admin'] },
  resolved: { closed: ['student', 'admin'], in_progress: ['admin'] },
  closed: { in_progress: ['admin'] },
  rejected: {},
});

// Transitions that must carry an explanatory note.
const NOTE_REQUIRED = Object.freeze({
  rejected: 'A rejection reason is required',
  needs_information: 'Please describe what information is needed',
  resolved: 'A resolution note is required',
});

const STATUS_LABELS = Object.freeze({
  submitted: 'Submitted',
  under_review: 'Under Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
  needs_information: 'Needs Information',
});

function canTransition(from, to, role) {
  const roles = TRANSITIONS[from]?.[to];
  return Array.isArray(roles) && roles.includes(role);
}

/** Next statuses a role may choose from the given status. */
function allowedNextStatuses(from, role) {
  return Object.entries(TRANSITIONS[from] || {})
    .filter(([, roles]) => roles.includes(role))
    .map(([to]) => to);
}

function isReopen(from, to) {
  return (from === 'resolved' || from === 'closed') && to === 'in_progress';
}

module.exports = { TRANSITIONS, NOTE_REQUIRED, STATUS_LABELS, canTransition, allowedNextStatuses, isReopen };
