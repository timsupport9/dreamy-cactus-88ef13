const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/auth.controller');

router.post('/register', authLimiter, validate([
  body('name').trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
]), ctrl.register);

router.post('/login', authLimiter, validate([
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
]), ctrl.login);

router.post('/refresh', ctrl.refreshToken);

router.post('/forgot-password', authLimiter, validate([body('email').isEmail().normalizeEmail()]), ctrl.forgotPassword);

router.post('/reset-password', authLimiter, validate([
  body('token').notEmpty(), body('newPassword').isLength({ min: 6 })
]), ctrl.resetPassword);

router.get('/me', authenticate, ctrl.me);

router.post('/change-password', authenticate, validate([
  body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })
]), ctrl.changePassword);

router.post('/logout', authenticate, ctrl.logout);

module.exports = router;
