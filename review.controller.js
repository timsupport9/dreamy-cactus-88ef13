const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { recomputeExpertRating } = require('../services/analytics.service');
const { notifyUser } = require('../services/socket.service');

exports.createReview = asyncHandler(async (req, res) => {
  const { consultationId, rating, title, body } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5' });

  const c = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!c || c.clientId !== req.user.id) return res.status(404).json({ error: 'Consultation not found' });
  if (c.status !== 'COMPLETED') return res.status(400).json({ error: 'Can only review completed consultations' });
  if (c.reviewId) return res.status(400).json({ error: 'Already reviewed' });

  const review = await prisma.$transaction(async (tx) => {
    const r = await tx.review.create({
      data: {
        authorId: req.user.id, targetId: c.expertId, consultationId: c.id,
        rating: parseInt(rating, 10), title: title?.trim(), body: body?.trim()
      }
    });
    await tx.consultation.update({ where: { id: c.id }, data: { reviewId: r.id, rating: parseInt(rating, 10) } });
    return r;
  });

  await recomputeExpertRating(c.expertId);
  await notifyUser(c.expertId, {
    title: 'New review received',
    message: `${req.user.name} left you a ${rating}-star review`,
    type: 'review'
  });
  res.status(201).json({ review });
});

exports.listForExpert = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { targetId: req.params.expertId, isPublished: true },
      orderBy: { createdAt: 'desc' }, skip, take,
      include: { author: { select: { id: true, name: true, avatarUrl: true } } }
    }),
    prisma.review.count({ where: { targetId: req.params.expertId, isPublished: true } })
  ]);
  res.json({ reviews, meta: buildMeta(total, page, limit) });
});

exports.myReviews = asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { authorId: req.user.id }, orderBy: { createdAt: 'desc' },
    include: { target: { select: { id: true, name: true, avatarUrl: true } } }
  });
  res.json({ reviews });
});

exports.hideReview = asyncHandler(async (req, res) => {
  const r = await prisma.review.update({ where: { id: req.params.id }, data: { isPublished: false } });
  await recomputeExpertRating(r.targetId);
  res.json({ message: 'Review hidden' });
});
