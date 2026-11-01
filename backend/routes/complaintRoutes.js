const express = require('express');
const auth = require('../middleware/auth');
const authorizeRole = require('../middleware/authorizeRole');
const validate = require('../middleware/validate');
const { uploadImages } = require('../middleware/upload');
const v = require('../validators/complaintValidators');
const ctrl = require('../controllers/complaintController');

const router = express.Router();
const student = authorizeRole('student');

router.use(auth);

router.post('/', student, uploadImages, validate(v.create), ctrl.create);
router.get('/my', student, validate(v.listQuery), ctrl.listMine);
router.get('/my/stats', student, ctrl.myStats);
router.get('/track/:code', ctrl.track);

// Ownership / assignment checks happen inside each handler.
router.get('/:id', ctrl.getById);
router.patch('/:id', student, validate(v.update), ctrl.update);
router.post('/:id/attachments', uploadImages, ctrl.uploadAttachments);
router.post('/:id/notes', validate(v.addNote), ctrl.addNote);
router.post('/:id/close', student, ctrl.close);
router.post('/:id/reopen-request', student, validate(v.reopenRequest), ctrl.requestReopen);
router.post('/:id/feedback', student, validate(v.feedback), ctrl.submitFeedback);

module.exports = router;
