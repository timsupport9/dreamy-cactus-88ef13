const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { splitPayment } = require('../utils/helpers');
const { notifyAdmins } = require('../services/socket.service');

exports.myConsultations = asyncHandler(async (req, res) => {
  const consultations = await prisma.consultation.findMany({
    where: { clientId: req.user.id }, orderBy: { createdAt: 'desc' },
    include: {
      expert: { select: { id: true, name: true, avatarUrl: true } },
      service: { select: { title: true, price: true } }
    }
  });
  res.json({ consultations });
});

exports.createConsultation = asyncHandler(async (req, res) => {
  const { title, description, consultationType, serviceId, expertId } = req.body;
  let amount = 0, commissionAmount = 0, expertPayout = 0;

  if (serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (service) {
      const cfg = await prisma.commissionConfig.findFirst({ where: { isActive: true } });
      const { commission, payout } = splitPayment(service.price, cfg?.percentage ?? 20);
      amount = service.price;
      commissionAmount = commission;
      expertPayout = payout;
    }
  }

  const consultation = await prisma.consultation.create({
    data: {
      clientId: req.user.id, expertId: expertId || null, serviceId: serviceId || null,
      title, description, consultationType: consultationType || 'chat',
      amount, commissionAmount, expertPayout
    }
  });
  await notifyAdmins({ title: 'New consultation request', message: `${req.user.name} requested: ${title}` }).catch(() => {});
  res.status(201).json({ consultation });
});

exports.cancelConsultation = asyncHandler(async (req, res) => {
  const c = await prisma.consultation.findFirst({ where: { id: req.params.id, clientId: req.user.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (['COMPLETED', 'CANCELLED'].includes(c.status))
    return res.status(400).json({ error: `Cannot cancel a ${c.status} consultation` });
  const updated = await prisma.consultation.update({ where: { id: c.id }, data: { status: 'CANCELLED' } });
  res.json({ consultation: updated });
});

exports.fileClaim = asyncHandler(async (req, res) => {
  const { consultationId, claimType, title, description, amount } = req.body;
  const claim = await prisma.claim.create({
    data: { clientId: req.user.id, consultationId, claimType: claimType || 'OTHER',
      title, description, amount: parseFloat(amount) || 0 }
  });
  await notifyAdmins({ title: 'New client claim', message: `${req.user.name}: ${title}` }).catch(() => {});
  res.status(201).json({ claim });
});

exports.myClaims = asyncHandler(async (req, res) => {
  const claims = await prisma.claim.findMany({ where: { clientId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ claims });
});

exports.applyAsExpert = asyncHandler(async (req, res) => {
  const existing = await prisma.expertProfile.findUnique({ where: { userId: req.user.id } });
  if (existing) return res.status(400).json({ error: 'Already applied' });
  const profile = await prisma.expertProfile.create({
    data: {
      userId: req.user.id,
      expertise: req.body.expertise || [],
      bio: req.body.bio || '',
      hourlyRate: parseFloat(req.body.hourlyRate) || 0,
      languages: []
    }
  });
  await notifyAdmins({ title: 'Expert application', message: `${req.user.name} applied to become an expert` }).catch(() => {});
  res.status(201).json({ profile });
});

exports.createSupportTicket = asyncHandler(async (req, res) => {
  const { subject, message, category } = req.body;
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user.id, subject, category: category || 'general',
      messages: { create: { authorId: req.user.id, body: message, isStaff: false } }
    },
    include: { messages: true }
  });
  await notifyAdmins({ title: 'New support ticket', message: subject }).catch(() => {});
  res.status(201).json({ ticket });
});

exports.mySupportTickets = asyncHandler(async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user.id }, orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });
  res.json({ tickets });
});
