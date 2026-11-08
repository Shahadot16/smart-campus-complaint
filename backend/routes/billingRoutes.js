const express = require('express');
const auth = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const ctrl = require('../controllers/billingController');

const router = express.Router();

// Billing is managed by a university's administrator.
router.use(auth, requirePermission('settings.manage'));

router.get('/plans', ctrl.plans);
router.get('/subscription', ctrl.subscription);
router.post('/subscribe', ctrl.subscribe);
router.get('/invoices', ctrl.invoices);
router.get('/invoices/:id', ctrl.invoice);
router.post('/invoices/:id/pay', ctrl.payInvoice);

module.exports = router;
