const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { requirePermission } = require('../utils/permissions');
const cv = require('../validators/complaintValidators');
const assets = require('../controllers/assetController');
const inventory = require('../controllers/inventoryController');
const workOrders = require('../controllers/workOrderController');
const dept = require('../controllers/deptController');
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

// The role -> permission matrix, shown on the admin "Roles & permissions" page.
router.get('/permissions', auth, requirePermission('users.manage'), (_req, res) =>
  sendSuccess(res, { data: { permissions: PERMISSIONS, roles: ROLE_PERMISSIONS } })
);

module.exports = router;
