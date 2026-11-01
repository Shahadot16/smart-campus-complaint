const express = require('express');
const auth = require('../middleware/auth');
const authorizeRole = require('../middleware/authorizeRole');
const validate = require('../middleware/validate');
const cv = require('../validators/complaintValidators');
const av = require('../validators/adminValidators');
const ctrl = require('../controllers/adminController');
const sla = require('../controllers/slaController');
const locations = require('../controllers/locationController');
const assets = require('../controllers/assetController');
const inventory = require('../controllers/inventoryController');
const workOrders = require('../controllers/workOrderController');

const router = express.Router();

router.use(auth, authorizeRole('admin'));

router.get('/complaints', validate(cv.listQuery), ctrl.listComplaints);
router.patch('/complaints/:id/status', validate(cv.statusChange), ctrl.changeStatus);
router.patch('/complaints/:id/assign', validate(cv.assign), ctrl.assign);
router.patch('/complaints/:id/priority', validate(cv.priority), ctrl.setPriority);
router.get('/complaints/:id/suggest-staff', ctrl.suggestStaff);

router.get('/users', validate(av.listUsers), ctrl.listUsers);
router.post('/users', validate(av.createUser), ctrl.createUser);
router.patch('/users/:id', validate(av.updateUser), ctrl.updateUser);
router.get('/staff', ctrl.listStaff);
router.put('/staff/:id/profile', validate(av.staffProfile), ctrl.updateStaffProfile);

router.post('/categories', validate(av.createCategory), ctrl.createCategory);
router.patch('/categories/:id', validate(av.updateCategory), ctrl.updateCategory);

router.get('/reports', validate(av.reports), ctrl.reports);
router.get('/audit-logs', ctrl.auditLogs);
router.get('/online', ctrl.online);

router.get('/sla-policies', sla.list);
router.put('/sla-policies', validate(av.slaPolicy), sla.upsert);
router.delete('/sla-policies/:id', sla.remove);
router.get('/reports/sla', validate(av.reports), sla.report);

router.get('/jobs', sla.jobs);
router.post('/jobs/:name/run', sla.runJob);

router.post('/locations', validate(av.createLocation), locations.create);
router.patch('/locations/:id', validate(av.updateLocation), locations.update);

router.post('/assets', validate(av.asset(true)), assets.create);
router.patch('/assets/:id', validate(av.asset(false)), assets.update);

router.post('/parts', validate(av.part(true)), inventory.create);
router.patch('/parts/:id', validate(av.part(false)), inventory.update);
router.post('/parts/:id/stock', validate(av.stock), inventory.addStock);
router.get('/parts/:id/movements', inventory.movements);

router.put('/work-orders/limits', validate(av.limits), workOrders.setLimits);

module.exports = router;
