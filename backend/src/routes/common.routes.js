const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const c = require('../controllers/common.controller');

router.get('/experts', c.listExperts);
router.get('/experts/:id', c.getExpertById);

router.get('/notifications', authenticate, c.listNotifications);
router.post('/notifications/:id/read', authenticate, c.markRead);
router.post('/notifications/read-all', authenticate, c.markAllRead);

router.get('/consultations/:id/messages', authenticate, c.getMessages);
router.post('/consultations/:id/messages', authenticate, c.sendMessage);
router.post('/consultations/:id/attachments', authenticate, upload.array('files', 5), c.uploadAttachments);

module.exports = router;
