const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/coupon.controller');

router.use(authenticate, authorize('ADMIN'));
router.get('/', c.listCoupons);
router.post('/', c.createCoupon);
router.patch('/:id', c.updateCoupon);
router.delete('/:id', c.deleteCoupon);

module.exports = router;
