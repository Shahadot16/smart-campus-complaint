const ROLES = Object.freeze({ STUDENT: 'student', ADMIN: 'admin', STAFF: 'staff', DEPT_HEAD: 'dept_head', SUPER_ADMIN: 'super_admin' });

const PRIORITIES = Object.freeze(['low', 'medium', 'high', 'critical']);

const STATUSES = Object.freeze([
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'rejected',
  'needs_information',
]);

const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

module.exports = { ROLES, PRIORITIES, STATUSES, ALLOWED_IMAGE_TYPES };
