const express = require('express');
const auth = require('../middleware/auth');
const common = require('../controllers/commonController');
const complaints = require('../controllers/complaintController');
const locations = require('../controllers/locationController');

const router = express.Router();

// auth is applied per route so unknown /api paths still fall through to a 404.
router.get('/meta', common.meta); // public: university profile for the login/register pages
router.get('/categories', auth, common.listCategories);
router.get('/locations', auth, locations.tree);
router.get('/locations/stats', auth, locations.stats);
router.get('/locations/code/:code', auth, locations.byCode);
router.get('/attachments/:id/file', auth, complaints.downloadAttachment);

router.get('/notifications', auth, common.listNotifications);
router.patch('/notifications/read-all', auth, common.markAllRead);
router.patch('/notifications/:id/read', auth, common.markRead);

module.exports = router;
