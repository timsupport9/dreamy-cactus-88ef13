const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/user.controller');

router.use(authenticate);

router.get('/consultations', c.myConsultations);
router.post('/consultations', c.createConsultation);
router.post('/consultations/:id/cancel', c.cancelConsultation);

router.get('/claims', c.myClaims);
router.post('/claims', c.fileClaim);

router.post('/apply-expert', c.applyAsExpert);

router.get('/support-tickets', c.mySupportTickets);
router.post('/support-tickets', c.createSupportTicket);

module.exports = router;
