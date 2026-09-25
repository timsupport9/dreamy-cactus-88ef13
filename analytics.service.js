const prisma = require('../config/prisma');

async function getPlatformAnalytics({ range = '30d' } = {}) {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const since = new Date(Date.now() - days * 86400000);

  const [
    totalUsers, activeUsers, pendingUsers, totalExperts, activeExperts,
    totalConsultations, activeConsultations, completedConsultations,
    totalRevenue, totalCommission, activeClaims, pendingWithdrawals,
    postCount, recentSignups
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { role: 'EXPERT' } }),
    prisma.user.count({ where: { role: 'EXPERT', status: 'ACTIVE' } }),
    prisma.consultation.count(),
    prisma.consultation.count({ where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } }),
    prisma.consultation.count({ where: { status: 'COMPLETED' } }),
    prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { commissionAmount: true } }),
    prisma.claim.count({ where: { status: { in: ['FILED', 'UNDER_REVIEW'] } } }),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.user.count({ where: { createdAt: { gte: since } } })
  ]);

  const signupRows = await prisma.$queryRaw`
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
    FROM users WHERE created_at >= ${since}
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d') ORDER BY day ASC`;

  const revenueRows = await prisma.$queryRaw`
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COALESCE(SUM(amount),0) AS revenue
    FROM payments WHERE status = 'PAID' AND created_at >= ${since}
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d') ORDER BY day ASC`;

  return {
    stats: {
      totalUsers, activeUsers, pendingUsers, totalExperts, activeExperts,
      totalConsultations, activeConsultations, completedConsultations,
      totalRevenue: totalRevenue._sum.amount || 0,
      totalCommission: totalCommission._sum.commissionAmount || 0,
      activeClaims, pendingWithdrawals, postCount, recentSignups, currency: 'KES'
    },
    series: {
      signups: signupRows.map((r) => ({ day: r.day, count: Number(r.count) })),
      revenue: revenueRows.map((r) => ({ day: r.day, revenue: Number(r.revenue) }))
    }
  };
}

async function recomputeExpertRating(expertUserId) {
  const r = await prisma.review.aggregate({
    where: { targetId: expertUserId, isPublished: true },
    _avg: { rating: true }, _count: true
  });
  await prisma.expertProfile.update({
    where: { userId: expertUserId },
    data: { averageRating: r._avg.rating || 0, totalReviews: r._count || 0 }
  });
}

module.exports = { getPlatformAnalytics, recomputeExpertRating };
