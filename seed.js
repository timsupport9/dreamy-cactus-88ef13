const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding MySQL…');

  /* Wipe (order matters) */
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.supportMessage.deleteMany(),
    prisma.supportTicket.deleteMany(),
    prisma.claim.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.withdrawal.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.like.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.review.deleteMany(),
    prisma.message.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.consultation.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.event.deleteMany(),
    prisma.service.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.expertProfile.deleteMany(),
    prisma.bootcamp.deleteMany(),
    prisma.shortCourse.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.user.deleteMany(),
    prisma.commissionConfig.deleteMany()
  ]);

  const [a, e, u] = await Promise.all([
    bcrypt.hash('admin123', 10),
    bcrypt.hash('expert123', 10),
    bcrypt.hash('user123', 10)
  ]);

  const admin = await prisma.user.create({ data: {
    email: 'admin@platform.com', passwordHash: a, name: 'Admin User',
    role: 'ADMIN', status: 'ACTIVE', emailVerified: true, referralCode: 'ADMIN001'
  }});

  const expert1 = await prisma.user.create({ data: {
    email: 'expert@platform.com', passwordHash: e, name: 'John Mwangi',
    role: 'EXPERT', status: 'ACTIVE', emailVerified: true, phone: '+254712345678',
    referralCode: 'JOHN001',
    expertProfile: { create: {
      headline: 'Senior Full-Stack Engineer',
      expertise: ['Web Development', 'Cloud Computing', 'Python'],
      bio: 'Full-stack developer with 10+ years building scalable systems for Kenyan startups.',
      hourlyRate: 5000, yearsExperience: 10, languages: ['English', 'Swahili'],
      totalEarnings: 250000, availableBalance: 180000, totalPaidOut: 20000,
      averageRating: 4.8, totalReviews: 25, completionRate: 96, isVerified: true
    }}
  }, include: { expertProfile: true } });

  const expert2 = await prisma.user.create({ data: {
    email: 'sarah@platform.com', passwordHash: e, name: 'Sarah Wanjiku',
    role: 'EXPERT', status: 'ACTIVE', emailVerified: true, referralCode: 'SARAH001',
    expertProfile: { create: {
      headline: 'Business Strategy Consultant',
      expertise: ['Business Strategy', 'Marketing', 'Finance'],
      bio: 'MBA with 8 years of strategic advisory experience across East Africa.',
      hourlyRate: 8000, yearsExperience: 8, languages: ['English', 'Swahili'],
      totalEarnings: 400000, availableBalance: 320000,
      averageRating: 4.5, totalReviews: 18, completionRate: 92, isVerified: true
    }}
  }, include: { expertProfile: true } });

  const user = await prisma.user.create({ data: {
    email: 'user@platform.com', passwordHash: u, name: 'Jane Wambui',
    role: 'USER', status: 'ACTIVE', emailVerified: true, phone: '+254723456789',
    referralCode: 'JANE001'
  }});

  const service1 = await prisma.service.create({ data: {
    expertId: expert1.expertProfile.id, title: 'Technical Consultation',
    slug: 'technical-consultation', description: '1-on-1 technical consultation for your project.',
    price: 5000, commissionPercent: 20, expertPayout: 4000,
    durationMinutes: 60, category: 'Technology', tags: ['coding', 'architecture', 'debugging']
  }});
  await prisma.service.create({ data: {
    expertId: expert1.expertProfile.id, title: 'Code Review',
    slug: 'code-review', description: 'In-depth code review with actionable feedback.',
    price: 3500, commissionPercent: 20, expertPayout: 2800,
    durationMinutes: 45, category: 'Technology', tags: ['review']
  }});
  await prisma.service.create({ data: {
    expertId: expert2.expertProfile.id, title: 'Business Strategy Session',
    slug: 'business-strategy-session', description: 'Strategic planning for growth.',
    price: 8000, commissionPercent: 20, expertPayout: 6400,
    durationMinutes: 90, category: 'Business', tags: ['strategy']
  }});

  await prisma.consultation.create({ data: {
    clientId: user.id, expertId: expert1.id, serviceId: service1.id,
    title: 'React Application Debugging', description: 'Need help debugging my React app.',
    consultationType: 'chat', status: 'IN_PROGRESS', paymentStatus: 'PAID',
    amount: 5000, commissionAmount: 1000, expertPayout: 4000,
    messages: { create: [
      { senderId: user.id, body: 'Hi, I need help with my React app.' },
      { senderId: expert1.id, body: 'Sure! Share your code please.' }
    ]}
  }});

  const posts = [
    { authorId: admin.id, title: "Karibu ExpertHub — Kenya's Premier Expert Platform",
      slug: 'karibu-experthub', excerpt: 'Discover how ExpertHub is transforming online learning and consulting in Kenya.',
      content: '<h2>Karibu!</h2><p>ExpertHub connects Kenyans with verified experts and world-class courses. Pay with M-Pesa, learn from the best.</p>',
      category: 'Announcements', tags: ['welcome', 'kenya', 'platform'],
      status: 'PUBLISHED', isFeatured: true, publishedAt: new Date() },
    { authorId: expert1.id, title: '5 Signs Your Startup Needs a Technical Co-Founder',
      slug: 'signs-you-need-technical-cofounder', excerpt: "Founders often struggle with tech decisions. Here are 5 signals it's time.",
      content: '<h2>The Technical Co-Founder Question</h2><p>Every non-technical founder eventually asks: "Do I need a CTO?"</p>',
      category: 'Business', tags: ['startup', 'cto'], status: 'PUBLISHED', publishedAt: new Date() },
    { authorId: expert2.id, title: 'How to Price Your Consulting Services in Kenya',
      slug: 'pricing-consulting-kenya', excerpt: 'A practical framework for pricing knowledge work in the Kenyan market.',
      content: '<h2>Pricing Knowledge Work</h2><p>Pricing is the biggest lever on your consulting income.</p>',
      category: 'Consulting', tags: ['pricing', 'consulting'], status: 'PUBLISHED', publishedAt: new Date() }
  ];
  for (const p of posts) await prisma.post.create({ data: p });

  await prisma.commissionConfig.create({ data: { type: 'default', percentage: 20, isActive: true } });
  await prisma.coupon.createMany({ data: [
    { code: 'KARIBU20', description: '20% off your first consultation',
      discountType: 'PERCENTAGE', discountValue: 20, minOrderAmount: 1000,
      maxUses: 1000, expiresAt: new Date(Date.now() + 90 * 86400000) },
    { code: 'SAVE500', description: 'KES 500 off any consultation',
      discountType: 'FIXED', discountValue: 500, minOrderAmount: 2000,
      maxUses: 500, expiresAt: new Date(Date.now() + 60 * 86400000) }
  ]});

  await prisma.bootcamp.create({ data: {
    title: 'Full-Stack Developer Bootcamp', slug: 'full-stack-developer-bootcamp',
    description: 'Become a full-stack developer in 12 weeks. Real projects, real mentors.',
    category: 'Technology', durationWeeks: 12, intensity: 'full-time',
    price: 99000, maxStudents: 25, expertId: expert1.id,
    startDate: new Date(Date.now() + 14 * 86400000)
  }});

  await prisma.shortCourse.create({ data: {
    title: 'Python for Absolute Beginners', slug: 'python-for-beginners',
    description: 'Learn Python from zero. No experience required.',
    category: 'Programming', durationHours: 20, price: 19900,
    difficultyLevel: 'beginner', expertId: expert1.id
  }});

  console.log('✅ Seed complete');
  console.log('admin@platform.com / admin123');
  console.log('expert@platform.com / expert123');
  console.log('user@platform.com / user123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
