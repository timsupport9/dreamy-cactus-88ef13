const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/eschool.controller');

router.get('/bootcamps', c.getBootcamps);
router.get('/short-courses', c.getShortCourses);
router.get('/events', c.getEvents);
router.post('/enroll', authenticate, c.enroll);
router.get('/enrollments', authenticate, c.myEnrollments);

module.exports = router;
