const express = require('express');
const auth = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const ctrl = require('../controllers/settingsController');

const router = express.Router();

// Branding/profile settings are managed by a university's administrator.
router.use(auth, requirePermission('settings.manage'));

router.get('/branding', ctrl.getBranding);
router.patch('/branding', ctrl.updateBranding);

module.exports = router;
