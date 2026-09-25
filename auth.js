const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');

async function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(h.slice(7), env.jwt.secret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, phone: true, referralCode: true }
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.status === 'SUSPENDED') return res.status(403).json({ error: 'Account suspended' });
    if (user.status === 'DELETED') return res.status(403).json({ error: 'Account deleted' });
    req.user = user;
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

function optionalAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next();
  try {
    const d = jwt.verify(h.slice(7), env.jwt.secret);
    req.user = { id: d.id, role: d.role };
  } catch (_) {}
  next();
}

const verifyToken = (t) => jwt.verify(t, env.jwt.secret);

module.exports = { authenticate, authorize, optionalAuth, verifyToken };
