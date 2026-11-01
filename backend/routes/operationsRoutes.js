const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { requirePermission } = require('../utils/permissions');
const cv = require('../validators/complaintValidators');
const assets = require('../controllers/assetController');
const inventory = require('../controllers/inventoryController');
const workOrders = require('../controllers/workOrderController');
const dept = require('../controllers/deptController');
const aiCtrl = require('../controllers/aiController');
const analytics = require('../controllers/analyticsController');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config/env');
const { ROLE_PERMISSIONS, PERMISSIONS } = require('../utils/permissions');
const { sendSuccess } = require('../utils/response');

// Routes shared by several roles; access is decided by permission, not by role name.
const router = express.Router();

router.get('/assets/code/:code', auth, assets.byCode);
router.get('/assets', auth, requirePermission('assets.view'), assets.list);
router.get('/assets/:id', auth, requirePermission('assets.view'), assets.get);

router.get('/parts', auth, requirePermission('inventory.use', 'inventory.manage'), inventory.list);

router.get('/work-orders/limits', auth, requirePermission('workorders.create', 'workorders.approve'), workOrders.limits);
router.get('/work-orders', auth, requirePermission('workorders.approve'), workOrders.inbox);
router.post('/work-orders/:id/decision', auth, requirePermission('workorders.approve'), validate(cv.decision), workOrders.decide);
router.post('/work-orders/:id/complete', auth, requirePermission('workorders.create', 'workorders.approve'), workOrders.complete);

router.get('/dept/complaints', auth, requirePermission('complaints.view_department'), validate(cv.listQuery), dept.complaints);
router.get('/dept/stats', auth, requirePermission('complaints.view_department'), dept.stats);

// Smart features. Limited per user so an API key can't be drained.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  skip: () => config.isTest,
  keyGenerator: (req) => (req.user ? String(req.user._id) : ipKeyGenerator(req.ip)),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests. Please wait a minute.' },
});
router.get('/ai/status', auth, aiCtrl.status);
router.post('/ai/classify', auth, aiLimiter, validate(cv.aiDraft), aiCtrl.classify);
router.post('/ai/similar', auth, aiLimiter, validate(cv.aiDraft), aiCtrl.similarDraft);
router.post('/ai/chat', auth, aiLimiter, validate(cv.aiChat), aiCtrl.chat);
router.get('/complaints/:id/similar', auth, aiCtrl.similarTo);
router.get('/admin/ai/summary', auth, requirePermission('reports.view'), aiCtrl.weeklySummary);
router.get('/admin/analytics', auth, requirePermission('reports.view'), analytics.analytics);
router.get('/admin/reports/export.xlsx', auth, requirePermission('reports.view'), analytics.exportExcel);

// The role -> permission matrix, shown on the admin "Roles & permissions" page.
router.get('/permissions', auth, requirePermission('users.manage'), (_req, res) =>
  sendSuccess(res, { data: { permissions: PERMISSIONS, roles: ROLE_PERMISSIONS } })
);

module.exports = router;
