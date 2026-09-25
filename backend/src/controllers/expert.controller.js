const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { makeUniqueSlug, splitPayment, addDays } = require('../utils/helpers');

exports.myConsultations = asyncHandler(async (req, res) => {
  const consultations = await prisma.consultation.findMany({
    where: { expertId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { client: { select: { id: true, name: true, email: true, avatarUrl: true } } }
  });
  res.json({ consultations });
});

exports.updateConsultationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const c = await prisma.consultation.findFirst({ where: { id: req.params.id, expertId: req.user.id } });
  if (!c) return res.status(404).json({ error: 'Consultation not found' });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.consultation.update({
      where: { id: c.id },
      data: { status, completedAt: status === 'COMPLETED' ? new Date() : c.completedAt }
    });
    if (status === 'COMPLETED') {
      await tx.expertProfile.update({
        where: { userId: req.user.id },
        data: {
          totalEarnings: { increment: u.expertPayout },
          availableBalance: { increment: u.expertPayout }
        }
      });
    }
    return u;
  });
  res.json({ consultation: updated });
});

exports.earnings = asyncHandler(async (req, res) => {
  const [profile, payments] = await Promise.all([
    prisma.expertProfile.findUnique({ where: { userId: req.user.id } }),
    prisma.withdrawal.findMany({ where: { expertId: req.user.id }, orderBy: { createdAt: 'desc' } })
  ]);
  res.json({ summary: profile, payments });
});

exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, withdrawalMethod, accountDetails } = req.body;
  const parsed = parseFloat(amount);

  const profile = await prisma.expertProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  if (parsed > profile.availableBalance) return res.status(400).json({ error: 'Insufficient balance' });
  if (parsed < 200) return res.status(400).json({ error: 'Minimum withdrawal is KES 200' });

  const w = await prisma.$transaction(async (tx) => {
    const created = await tx.withdrawal.create({
      data: {
        expertId: req.user.id, amount: parsed,
        method: withdrawalMethod || 'mpesa',
        accountDetails: accountDetails || {},
        holdingPeriodEnd: addDays(7)
      }
    });
    await tx.expertProfile.update({
      where: { userId: req.user.id },
      data: { availableBalance: { decrement: parsed }, pendingPayout: { increment: parsed } }
    });
    return created;
  });
  res.status(201).json({ withdrawal: w, message: 'Withdrawal requested. 7-day holding period.' });
});

exports.listServices = asyncHandler(async (req, res) => {
  const services = await prisma.service.findMany({ where: { expertId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ services });
});

exports.createService = asyncHandler(async (req, res) => {
  const { title, description, serviceType, price, durationMinutes, category, tags } = req.body;
  const cfg = await prisma.commissionConfig.findFirst({ where: { isActive: true } });
  const pct = cfg?.percentage ?? 20;
  const { payout } = splitPayment(price, pct);

  const service = await prisma.service.create({
    data: {
      expertId: req.user.id, title, slug: makeUniqueSlug(title), description,
      serviceType: serviceType || 'consultation',
      price: parseFloat(price), commissionPercent: pct, expertPayout: payout,
      durationMinutes: parseInt(durationMinutes, 10) || 60,
      category, tags: Array.isArray(tags) ? tags : []
    }
  });
  res.status(201).json({ service });
});

exports.updateService = asyncHandler(async (req, res) => {
  const s = await prisma.service.findFirst({ where: { id: req.params.id, expertId: req.user.id } });
  if (!s) return res.status(404).json({ error: 'Service not found' });
  const data = { ...req.body };
  if (req.body.price !== undefined) {
    const { payout } = splitPayment(req.body.price, s.commissionPercent);
    data.expertPayout = payout;
  }
  const updated = await prisma.service.update({ where: { id: s.id }, data });
  res.json({ service: updated });
});

exports.deleteService = asyncHandler(async (req, res) => {
  await prisma.service.deleteMany({ where: { id: req.params.id, expertId: req.user.id } });
  res.json({ message: 'Service deleted' });
});

exports.setAvailability = asyncHandler(async (req, res) => {
  const { schedule = [] } = req.body;
  await prisma.$transaction(async (tx) => {
    await tx.availability.deleteMany({ where: { expertId: req.user.id } });
    if (schedule.length) {
      await tx.availability.createMany({
        data: schedule.map((s) => ({
          expertId: req.user.id, dayOfWeek: Number(s.day),
          startTime: s.start, endTime: s.end, isActive: s.isActive !== false
        }))
      });
    }
  });
  res.json({ message: 'Availability updated' });
});

exports.getAvailability = asyncHandler(async (req, res) => {
  const [availability, timeOff] = await Promise.all([
    prisma.availability.findMany({ where: { expertId: req.user.id } }),
    prisma.timeOff.findMany({ where: { expertId: req.user.id } })
  ]);
  res.json({ availability, timeOff });
});

exports.requestTimeOff = asyncHandler(async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  const request = await prisma.timeOff.create({
    data: { expertId: req.user.id, startDate: new Date(startDate), endDate: new Date(endDate), reason }
  });
  res.status(201).json({ request });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }, include: { expertProfile: true }, omit: { passwordHash: true }
  });
  res.json({ user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, headline, bio, expertise, hourlyRate, languages } = req.body;
  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: req.user.id }, data: { name, phone } });
    await tx.expertProfile.update({
      where: { userId: req.user.id },
      data: { headline, bio, expertise, languages,
        hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : undefined }
    });
    return tx.user.findUnique({
      where: { id: req.user.id }, include: { expertProfile: true }, omit: { passwordHash: true }
    });
  });
  res.json({ user: result });
});
