const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateReferralCode } = require('../utils/helpers');
const { notifyAdmins } = require('../services/socket.service');
const { sendTemplate } = require('../services/email.service');

const signAccess = (u) => jwt.sign({ id: u.id, role: u.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
const signRefresh = (u) => jwt.sign({ id: u.id }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, referralCode } = req.body;

  if (await prisma.user.findUnique({ where: { email } }))
    return res.status(400).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);

  let referredById = null;
  if (referralCode) {
    const r = await prisma.user.findUnique({ where: { referralCode } });
    if (r) referredById = r.id;
  }

  const user = await prisma.user.create({
    data: {
      name, email, passwordHash, phone: phone || null,
      role: 'USER', status: 'ACTIVE', emailVerified: true,
      referralCode: generateReferralCode(name), referredById
    },
    select: { id: true, name: true, email: true, role: true, status: true, referralCode: true }
  });

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  const token = signAccess(full);
  const refreshToken = signRefresh(full);

  notifyAdmins({ title: 'New user registration', message: `${name} (${email}) signed up`, type: 'approval' }).catch(() => {});
  sendTemplate(email, 'welcome', name).catch(() => {});

  res.status(201).json({ message: 'Account created', token, refreshToken, user: { ...user, status: 'ACTIVE' } });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { expertProfile: true } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.status === 'PENDING') return res.status(403).json({ error: 'Account pending approval', status: 'PENDING' });
  if (user.status === 'SUSPENDED') return res.status(403).json({ error: 'Account suspended', status: 'SUSPENDED' });
  if (user.status === 'DELETED') return res.status(403).json({ error: 'Account deleted' });

  if (!(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = signAccess(user);
  const refreshToken = signRefresh(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { passwordHash, ...safe } = user;
  res.json({ token, refreshToken, user: safe });
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  try {
    const d = jwt.verify(refreshToken, env.jwt.refreshSecret);
    const user = await prisma.user.findUnique({ where: { id: d.id } });
    if (!user || user.status !== 'ACTIVE') return res.status(401).json({ error: 'Invalid refresh token' });
    res.json({ token: signAccess(user) });
  } catch { res.status(401).json({ error: 'Invalid refresh token' }); }
});

exports.me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { expertProfile: true },
    omit: { passwordHash: true }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
    return res.status(400).json({ error: 'Current password is incorrect' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.json({ message: 'Password updated' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ message: 'If that email exists, a reset link has been sent' });

  await prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 3600000) }
  });

  const resetUrl = `${env.frontendUrl}/?reset_token=${token}`;
  await sendTemplate(email, 'passwordReset', user.name, resetUrl).catch((e) => console.error('Reset email failed:', e.message));

  res.json({
    message: 'If that email exists, a reset link has been sent',
    ...(env.isProd ? {} : { resetUrl })
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Token and password (min 6) required' });

  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date())
    return res.status(400).json({ error: 'Invalid or expired reset link' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
  ]);
  res.json({ message: 'Password reset successfully. You can now log in.' });
});

exports.logout = asyncHandler(async (req, res) => res.json({ message: 'Logged out' }));
