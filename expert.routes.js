const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/expert.controller');

router.use(authenticate, authorize('EXPERT'));

router.get('/profile', c.getProfile);
router.patch('/profile', c.updateProfile);
router.get('/consultations', c.myConsultations);
router.patch('/consultations/:id/status', c.updateConsultationStatus);
router.get('/services', c.listServices);
router.post('/services', c.createService);
router.patch('/services/:id', c.updateService);
router.delete('/services/:id', c.deleteService);
router.get('/availability', c.getAvailability);
router.put('/availability', c.setAvailability);
router.post('/time-off', c.requestTimeOff);
router.get('/earnings', c.earnings);
router.post('/withdrawals', c.requestWithdrawal);

module.exports = router;
