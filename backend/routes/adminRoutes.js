const express = require('express');
const auth = require('../middleware/auth');
const authorizeRole = require('../middleware/authorizeRole');
const validate = require('../middleware/validate');
const cv = require('../validators/complaintValidators');
const av = require('../validators/adminValidators');
const ctrl = require('../controllers/adminController');

const router = express.Router();

router.use(auth, authorizeRole('admin'));

router.get('/complaints', validate(cv.listQuery), ctrl.listComplaints);
router.patch('/complaints/:id/status', validate(cv.statusChange), ctrl.changeStatus);
router.patch('/complaints/:id/assign', validate(cv.assign), ctrl.assign);
router.patch('/complaints/:id/priority', validate(cv.priority), ctrl.setPriority);

router.get('/users', validate(av.listUsers), ctrl.listUsers);
router.post('/users', validate(av.createUser), ctrl.createUser);
router.patch('/users/:id', validate(av.updateUser), ctrl.updateUser);
router.get('/staff', ctrl.listStaff);

router.post('/categories', validate(av.createCategory), ctrl.createCategory);
router.patch('/categories/:id', validate(av.updateCategory), ctrl.updateCategory);

router.get('/reports', validate(av.reports), ctrl.reports);
router.get('/audit-logs', ctrl.auditLogs);
router.get('/online', ctrl.online);

module.exports = router;
