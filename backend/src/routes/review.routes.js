const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/review.controller');

router.post('/', authenticate, c.createReview);
router.get('/expert/:expertId', c.listForExpert);
router.get('/mine', authenticate, c.myReviews);
router.post('/:id/hide', authenticate, authorize('ADMIN'), c.hideReview);

module.exports = router;
