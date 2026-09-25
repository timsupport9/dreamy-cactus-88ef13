const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/payment.controller');

router.post('/mpesa/stkpush', authenticate, paymentLimiter, validate([
  body('consultationId').notEmpty(), body('phone').notEmpty()
]), ctrl.initiatePayment);

router.get('/mpesa/status/:id', authenticate, ctrl.queryPaymentStatus);
router.get('/coupon/validate', ctrl.validateCoupon);
router.get('/mine', authenticate, ctrl.myPayments);
/* /mpesa/callback mounted in server.js with raw body parser */

module.exports = router;
