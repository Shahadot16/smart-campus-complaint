const ApiError = require('./ApiError');

/**
 * Role-based access control: what each role is allowed to do.
 * Routes ask for a permission (not a role), so a role's powers can change in one place.
 */
const PERMISSIONS = Object.freeze({
  'complaints.create': 'Submit complaints',
  'complaints.view_all': 'See every complaint on campus',
  'complaints.view_department': "See their department's complaints",
  'complaints.manage': 'Review, assign, reject and reprioritise complaints',
  'tasks.work': 'Work on assigned complaints',
  'workorders.create': 'Raise costed work orders',
  'workorders.approve': 'Approve or reject work orders',
  'inventory.use': 'Record spare parts used on a repair',
  'inventory.manage': 'Manage spare-part stock',
  'assets.view': 'View the asset register',
  'assets.manage': 'Add and edit assets',
  'users.manage': 'Manage user accounts',
  'settings.manage': 'Manage categories, locations, SLA and approval limits',
  'reports.view': 'View campus-wide reports',
  'reports.view_department': 'View department reports',
  'audit.view': 'View the audit log',
});

const ROLE_PERMISSIONS = Object.freeze({
  student: ['complaints.create'],
  staff: ['tasks.work', 'workorders.create', 'inventory.use', 'assets.view'],
  dept_head: ['complaints.view_department', 'workorders.approve', 'assets.view', 'reports.view_department'],
  admin: Object.keys(PERMISSIONS), // administrators can do everything
});

const can = (user, permission) => Boolean(user && ROLE_PERMISSIONS[user.role]?.includes(permission));

/** Middleware: allow the request when the user has any of the given permissions. */
const requirePermission =
  (...permissions) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!permissions.some((p) => can(req.user, p))) {
      return next(ApiError.forbidden('Your role does not have access to this resource'));
    }
    next();
  };

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, can, requirePermission };
