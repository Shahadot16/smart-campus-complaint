const express = require('express');
const auth = require('../middleware/auth');
const common = require('../controllers/commonController');
const complaints = require('../controllers/complaintController');

const router = express.Router();

// auth is applied per route so unknown /api paths still fall through to a 404.
router.get('/categories', auth, common.listCategories);
router.get('/attachments/:id/file', auth, complaints.downloadAttachment);

router.get('/notifications', auth, common.listNotifications);
router.patch('/notifications/read-all', auth, common.markAllRead);
router.patch('/notifications/:id/read', auth, common.markRead);

module.exports = router;
