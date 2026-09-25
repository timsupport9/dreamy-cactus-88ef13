const rateLimit = require('express-rate-limit');

module.exports = {
  authLimiter: rateLimit({ windowMs: 15 * 60 * 1000, max: 30,
    message: { error: 'Too many auth attempts, try later' },
    standardHeaders: true, legacyHeaders: false }),
  apiLimiter: rateLimit({ windowMs: 60 * 1000, max: 300,
    message: { error: 'Too many requests, slow down' },
    standardHeaders: true, legacyHeaders: false }),
  paymentLimiter: rateLimit({ windowMs: 60 * 1000, max: 10,
    message: { error: 'Too many payment attempts' } })
};
