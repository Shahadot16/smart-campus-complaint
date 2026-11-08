const express = require('express');
const auth = require('../middleware/auth');
const ApiError = require('../utils/ApiError');
const ctrl = require('../controllers/superController');
const authCtrl = require('../controllers/authController');

const router = express.Router();

function requireSuperAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return next(ApiError.forbidden('Platform administrator access only.'));
  }
  next();
}

// Public
router.get('/public-tenants', ctrl.publicTenants);
router.post('/login', ctrl.login);
router.post('/logout', authCtrl.logout);

// Super-admin only
router.use(auth, requireSuperAdmin);
router.get('/me', ctrl.me);
router.get('/stats', ctrl.stats);
router.get('/billing', ctrl.billing);
router.get('/tenants', ctrl.listTenants);
router.post('/tenants', ctrl.createTenant);
router.patch('/tenants/:id', ctrl.updateTenant);

module.exports = router;
