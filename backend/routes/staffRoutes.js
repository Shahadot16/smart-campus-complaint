const express = require('express');
const auth = require('../middleware/auth');
const authorizeRole = require('../middleware/authorizeRole');
const validate = require('../middleware/validate');
const v = require('../validators/complaintValidators');
const ctrl = require('../controllers/staffController');

const router = express.Router();

router.use(auth, authorizeRole('staff'));

router.get('/complaints', validate(v.listQuery), ctrl.listAssigned);
router.get('/stats', ctrl.stats);
router.patch('/complaints/:id/status', validate(v.statusChange), ctrl.changeStatus);

module.exports = router;
