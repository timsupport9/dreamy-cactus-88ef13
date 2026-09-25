const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { emitMessage } = require('../services/socket.service');
const { parsePagination, buildMeta } = require('../utils/pagination');

exports.listExperts = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { q } = req.query;
  const where = { role: 'EXPERT', status: 'ACTIVE', expertProfile: { isNot: null } };
  if (q) where.OR = [{ name: { contains: q } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take, omit: { passwordHash: true },
      include: {
        expertProfile: true,
        services: { where: { isActive: true }, select: { id: true, title: true, price: true, durationMinutes: true } }
      }
    }),
    prisma.user.count({ where })
  ]);
  res.json({ experts: users, meta: buildMeta(total, page, limit) });
});

exports.getExpertById = asyncHandler(async (req, res) => {
  const expert = await prisma.user.findFirst({
    where: { id: req.params.id, role: 'EXPERT', status: 'ACTIVE' },
    omit: { passwordHash: true },
    include: {
      expertProfile: true,
      services: { where: { isActive: true } },
      reviewsReceived: {
        where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 10,
        include: { author: { select: { id: true, name: true, avatarUrl: true } } }
      }
    }
  });
  if (!expert) return res.status(404).json({ error: 'Expert not found' });
  res.json({ expert });
});

exports.listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query, { page: 1, limit: 30 });
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where: { userId: req.user.id } }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
  ]);
  res.json({ notifications, unreadCount, meta: buildMeta(total, page, limit) });
});

exports.markRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } });
  res.json({ message: 'Marked as read' });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ message: 'All marked as read' });
});

exports.getMessages = asyncHandler(async (req, res) => {
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id }, include: { attachments: true } });
  if (!c) return res.status(404).json({ error: 'Not found' });

  const hasAccess = req.user.role === 'ADMIN' || c.clientId === req.user.id || c.expertId === req.user.id;
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const messages = await prisma.message.findMany({
    where: { consultationId: c.id }, orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } }
  });

  await prisma.message.updateMany({
    where: { consultationId: c.id, isRead: false, NOT: { senderId: req.user.id } },
    data: { isRead: true }
  });

  res.json({ messages, attachments: c.attachments });
});

exports.sendMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Empty message' });

  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.clientId !== req.user.id && c.expertId !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });

  const msg = await prisma.message.create({
    data: { consultationId: c.id, senderId: req.user.id, body: message.trim() },
    include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } }
  });
  emitMessage(c.id, msg);
  res.status(201).json({ message: msg });
});

exports.uploadAttachments = asyncHandler(async (req, res) => {
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });

  const hasAccess = c.clientId === req.user.id || c.expertId === req.user.id || req.user.role === 'ADMIN';
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const files = (req.files || []).map((f) => ({
    consultationId: c.id, uploaderId: req.user.id,
    fileName: f.originalname, fileUrl: `/uploads/${f.filename}`,
    mimeType: f.mimetype, size: f.size
  }));

  if (files.length) await prisma.attachment.createMany({ data: files });
  res.status(201).json({ attachments: files });
});
