const router = require('express').Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const c = require('../controllers/post.controller');

router.get('/', c.listPosts);
router.get('/mine', authenticate, c.myPosts);
router.get('/:slug', optionalAuth, c.getPostBySlug);

router.post('/', authenticate, c.createPost);
router.patch('/:id', authenticate, c.updatePost);
router.delete('/:id', authenticate, c.deletePost);
router.post('/:id/like', authenticate, c.toggleLike);
router.post('/:id/comments', authenticate, c.addComment);
router.delete('/comments/:id', authenticate, c.deleteComment);

module.exports = router;
