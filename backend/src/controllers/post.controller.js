const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { makeUniqueSlug, sanitizeText } = require('../utils/helpers');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { notifyUser } = require('../services/socket.service');

exports.listPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { category, featured, q } = req.query;
  const where = { status: 'PUBLISHED' };
  if (category) where.category = category;
  if (featured === 'true') where.isFeatured = true;
  if (q) where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }];

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where, orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }], skip, take,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, role: true } },
        _count: { select: { comments: true, likes: true } }
      }
    }),
    prisma.post.count({ where })
  ]);
  res.json({ posts, meta: buildMeta(total, page, limit) });
});

exports.getPostBySlug = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { slug: req.params.slug },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      comments: {
        where: { isHidden: false, parentId: null },
        orderBy: { createdAt: 'desc' }, take: 50,
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, name: true, avatarUrl: true } } }
          }
        }
      },
      _count: { select: { comments: true, likes: true } }
    }
  });
  if (!post || post.status !== 'PUBLISHED') return res.status(404).json({ error: 'Post not found' });
  prisma.post.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {});
  res.json({ post });
});

exports.createPost = asyncHandler(async (req, res) => {
  const { title, excerpt, content, coverImage, category, tags = [], status = 'DRAFT', isFeatured = false } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  if (isFeatured && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admins can feature posts' });

  const post = await prisma.post.create({
    data: {
      authorId: req.user.id,
      title: sanitizeText(title), slug: makeUniqueSlug(title),
      excerpt: excerpt ? sanitizeText(excerpt) : null,
      content: sanitizeText(content), coverImage: coverImage || null,
      category: category || 'General',
      tags: Array.isArray(tags) ? tags : [],
      status, isFeatured: !!isFeatured,
      publishedAt: status === 'PUBLISHED' ? new Date() : null
    },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } }
  });
  res.status(201).json({ post });
});

exports.updatePost = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.authorId !== req.user.id && req.user.role !== 'ADMIN')
    return res.status(403).json({ error: 'Not authorized' });

  const data = {};
  for (const k of ['title', 'excerpt', 'content', 'coverImage', 'category', 'tags', 'status']) {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  }
  if (req.user.role === 'ADMIN' && req.body.isFeatured !== undefined) data.isFeatured = !!req.body.isFeatured;
  if (data.status === 'PUBLISHED' && post.status !== 'PUBLISHED') data.publishedAt = new Date();

  const updated = await prisma.post.update({ where: { id: post.id }, data });
  res.json({ post: updated });
});

exports.deletePost = asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.authorId !== req.user.id && req.user.role !== 'ADMIN')
    return res.status(403).json({ error: 'Not authorized' });
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ message: 'Post deleted' });
});

exports.myPosts = asyncHandler(async (req, res) => {
  const posts = await prisma.post.findMany({ where: { authorId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ posts });
});

exports.toggleLike = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.like.findUnique({ where: { postId_userId: { postId: id, userId: req.user.id } } });

  if (existing) {
    await prisma.$transaction([
      prisma.like.delete({ where: { id: existing.id } }),
      prisma.post.update({ where: { id }, data: { likesCount: { decrement: 1 } } })
    ]);
    return res.json({ liked: false });
  }
  await prisma.$transaction([
    prisma.like.create({ data: { postId: id, userId: req.user.id } }),
    prisma.post.update({ where: { id }, data: { likesCount: { increment: 1 } } })
  ]);
  res.json({ liked: true });
});

exports.addComment = asyncHandler(async (req, res) => {
  const { body, parentId } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Comment required' });

  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const comment = await prisma.comment.create({
    data: { postId: post.id, authorId: req.user.id, parentId: parentId || null, body: sanitizeText(body) },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } }
  });
  await prisma.post.update({ where: { id: post.id }, data: { commentsCount: { increment: 1 } } });

  if (post.authorId !== req.user.id) {
    await notifyUser(post.authorId, {
      title: 'New comment', message: `${req.user.name} commented on your post`,
      type: 'comment', link: `/posts/${post.slug}`
    }).catch(() => {});
  }
  res.status(201).json({ comment });
});

exports.deleteComment = asyncHandler(async (req, res) => {
  const c = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Comment not found' });
  if (c.authorId !== req.user.id && req.user.role !== 'ADMIN')
    return res.status(403).json({ error: 'Not authorized' });

  await prisma.$transaction([
    prisma.comment.delete({ where: { id: c.id } }),
    prisma.post.update({ where: { id: c.postId }, data: { commentsCount: { decrement: 1 } } })
  ]);
  res.json({ message: 'Comment deleted' });
});
