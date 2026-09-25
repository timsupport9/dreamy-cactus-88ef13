const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { generateReferralCode } = require('../utils/helpers');
const { getPlatformAnalytics } = require('../services/analytics.service');
const { notifyUser } = require('../services/socket.service');
const { sendTemplate } = require('../services/email.service');

exports.analytics = asyncHandler(async (req, res) =>
  res.json(await getPlatformAnalytics({ range: req.query.range || '30d' })));

exports.dashboard = asyncHandler(async (req, res) =>
  res.json(await getPlatformAnalytics({ range: '7d' })));

/* USERS */
exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { role, status, q } = req.query;
  const where = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take,
      omit: { passwordHash: true }, include: { expertProfile: true } }),
    prisma.user.count({ where })
  ]);
  res.json({ users, meta: buildMeta(total, page, limit) });
});

exports.approveUser = asyncHandler(async (req, res) => {
  const u = await prisma.user.update({ where: { id: req.params.userId }, data: { status: 'ACTIVE' } });
  await notifyUser(u.id, { title: 'Account approved', message: 'Your account is now active!' });
  await sendTemplate(u.email, 'accountApproved', u.name).catch(() => {});
  res.json({ message: 'User approved', user: { id: u.id, name: u.name, status: u.status } });
});

exports.suspendUser = asyncHandler(async (req, res) => {
  const { reason = 'Admin action' } = req.body;
  const u = await prisma.user.update({ where: { id: req.params.userId }, data: { status: 'SUSPENDED' } });
  await notifyUser(u.id, { title: 'Account suspended', message: reason });
  await sendTemplate(u.email, 'accountSuspended', u.name, reason).catch(() => {});
  res.json({ message: 'User suspended' });
});

exports.reactivateUser = asyncHandler(async (req, res) => {
  const u = await prisma.user.update({ where: { id: req.params.userId }, data: { status: 'ACTIVE' } });
  await notifyUser(u.id, { title: 'Account reactivated', message: 'Welcome back!' });
  res.json({ message: 'User reactivated' });
});

/* EXPERTS */
exports.listExperts = asyncHandler(async (req, res) => {
  const experts = await prisma.user.findMany({
    where: { role: 'EXPERT' }, omit: { passwordHash: true },
    include: { expertProfile: true }, orderBy: { createdAt: 'desc' }
  });
  res.json({ experts });
});

exports.createExpert = asyncHandler(async (req, res) => {
  const { name, email, phone, expertise, bio, hourlyRate, password, headline } = req.body;
  if (await prisma.user.findUnique({ where: { email } }))
    return res.status(400).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password || 'Expert@123', 10);
  const expert = await prisma.user.create({
    data: {
      name, email, phone, passwordHash, role: 'EXPERT',
      status: 'ACTIVE', emailVerified: true,
      referralCode: generateReferralCode(name),
      expertProfile: { create: {
        headline: headline || null,
        expertise: Array.isArray(expertise) ? expertise : [expertise].filter(Boolean),
        bio: bio || '',
        hourlyRate: parseFloat(hourlyRate) || 0,
        languages: []
      }}
    },
    omit: { passwordHash: true }, include: { expertProfile: true }
  });
  await sendTemplate(email, 'welcome', name).catch(() => {});
  res.status(201).json({ expert });
});

exports.suspendExpert = asyncHandler(async (req, res) => {
  const { reason = 'Admin suspension' } = req.body;
  const u = await prisma.user.update({ where: { id: req.params.expertId }, data: { status: 'SUSPENDED' } });
  await notifyUser(u.id, { title: 'Account suspended', message: reason });
  res.json({ message: 'Expert suspended' });
});

exports.reactivateExpert = asyncHandler(async (req, res) => {
  const u = await prisma.user.update({ where: { id: req.params.expertId }, data: { status: 'ACTIVE' } });
  await notifyUser(u.id, { title: 'Account reactivated', message: 'Welcome back!' });
  res.json({ message: 'Expert reactivated' });
});

/* CONSULTATIONS */
exports.listConsultations = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { status } = req.query;
  const where = status ? { status } : {};
  const [consultations, total] = await Promise.all([
    prisma.consultation.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take,
      include: {
        client: { select: { id: true, name: true, email: true } },
        expert: { select: { id: true, name: true, email: true } },
        service: { select: { title: true, price: true } }
      }
    }),
    prisma.consultation.count({ where })
  ]);
  res.json({ consultations, meta: buildMeta(total, page, limit) });
});

exports.assignExpert = asyncHandler(async (req, res) => {
  const { expertId, serviceId } = req.body;
  const consultation = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

  const service = serviceId ? await prisma.service.findUnique({ where: { id: serviceId } }) : null;
  const amount = service?.price || consultation.amount || 0;
  const commission = (amount * (service?.commissionPercent || 20)) / 100;

  const updated = await prisma.consultation.update({
    where: { id: consultation.id },
    data: { expertId, serviceId: serviceId || null, status: 'ASSIGNED',
      amount, commissionAmount: commission, expertPayout: amount - commission }
  });
  await notifyUser(expertId, { title: 'New consultation assigned', message: consultation.title, type: 'assignment' });
  res.json({ consultation: updated });
});

/* WITHDRAWALS */
exports.listWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { status } = req.query;
  const where = status ? { status } : {};
  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take,
      include: { expert: { select: { id: true, name: true, email: true, phone: true } } }
    }),
    prisma.withdrawal.count({ where })
  ]);
  res.json({ withdrawals, meta: buildMeta(total, page, limit) });
});

exports.approveWithdrawal = asyncHandler(async (req, res) => {
  const w = await prisma.withdrawal.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date() }
  });
  await notifyUser(w.expertId, {
    title: 'Withdrawal approved',
    message: `Your withdrawal of KES ${w.amount} has been approved.`,
    type: 'payment'
  });
  res.json({ withdrawal: w });
});

exports.processWithdrawal = asyncHandler(async (req, res) => {
  const w = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
  if (!w) return res.status(404).json({ error: 'Not found' });

  await prisma.$transaction([
    prisma.withdrawal.update({ where: { id: w.id }, data: { status: 'COMPLETED', processedAt: new Date() } }),
    prisma.expertProfile.update({
      where: { userId: w.expertId },
      data: { pendingPayout: { decrement: w.amount }, totalPaidOut: { increment: w.amount } }
    })
  ]);
  const user = await prisma.user.findUnique({ where: { id: w.expertId } });
  if (user) sendTemplate(user.email, 'withdrawalProcessed', user.name, w.amount).catch(() => {});
  res.json({ message: 'Payment processed' });
});

exports.rejectWithdrawal = asyncHandler(async (req, res) => {
  const { reason = 'Rejected by admin' } = req.body;
  const w = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
  if (!w) return res.status(404).json({ error: 'Not found' });

  await prisma.$transaction([
    prisma.withdrawal.update({ where: { id: w.id }, data: { status: 'REJECTED', rejectionReason: reason } }),
    prisma.expertProfile.update({
      where: { userId: w.expertId },
      data: { availableBalance: { increment: w.amount }, pendingPayout: { decrement: w.amount } }
    })
  ]);
  await notifyUser(w.expertId, { title: 'Withdrawal rejected', message: reason, type: 'payment' });
  res.json({ message: 'Withdrawal rejected' });
});

/* CLAIMS */
exports.listClaims = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { status } = req.query;
  const where = status ? { status } : {};
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take,
      include: {
        client: { select: { id: true, name: true, email: true } },
        consultation: { select: { id: true, title: true } }
      }
    }),
    prisma.claim.count({ where })
  ]);
  res.json({ claims, meta: buildMeta(total, page, limit) });
});

exports.resolveClaim = asyncHandler(async (req, res) => {
  const { status = 'DISMISSED', resolution = '', refundAmount = 0 } = req.body;
  const claim = await prisma.claim.update({
    where: { id: req.params.id },
    data: { status, resolution, refundAmount: parseFloat(refundAmount) || 0,
      resolvedBy: req.user.id, resolvedAt: new Date() }
  });
  await notifyUser(claim.clientId, {
    title: 'Claim updated',
    message: `Your claim has been ${status.toLowerCase().replace('_', ' ')}`
  });
  res.json({ claim });
});
