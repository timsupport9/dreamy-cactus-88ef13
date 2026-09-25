const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/admin.controller');
const coupons = require('../controllers/coupon.controller');
const es = require('../controllers/eschool.controller');

router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', c.dashboard);
router.get('/analytics', c.analytics);

router.get('/users', c.listUsers);
router.post('/users/:userId/approve', c.approveUser);
router.post('/users/:userId/suspend', c.suspendUser);
router.post('/users/:userId/reactivate', c.reactivateUser);

router.get('/experts', c.listExperts);
router.post('/experts', c.createExpert);
router.post('/experts/:expertId/suspend', c.suspendExpert);
router.post('/experts/:expertId/reactivate', c.reactivateExpert);

router.get('/consultations', c.listConsultations);
router.post('/consultations/:id/assign', c.assignExpert);

router.get('/withdrawals', c.listWithdrawals);
router.post('/withdrawals/:id/approve', c.approveWithdrawal);
router.post('/withdrawals/:id/process', c.processWithdrawal);
router.post('/withdrawals/:id/reject', c.rejectWithdrawal);

router.get('/claims', c.listClaims);
router.post('/claims/:id/resolve', c.resolveClaim);

router.get('/coupons', coupons.listCoupons);
router.post('/coupons', coupons.createCoupon);
router.patch('/coupons/:id', coupons.updateCoupon);
router.delete('/coupons/:id', coupons.deleteCoupon);

router.post('/bootcamps', es.createBootcamp);
router.post('/short-courses', es.createShortCourse);

module.exports = router;
