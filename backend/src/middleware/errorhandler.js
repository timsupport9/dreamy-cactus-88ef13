const logger = require('../config/logger');

const notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path });
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A record with this value already exists' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
  }
  if (err.name === 'PrismaClientValidationError') return res.status(400).json({ error: 'Invalid data provided' });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
