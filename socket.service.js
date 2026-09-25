const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('ioredis');
const env = require('../config/env');
const logger = require('../config/logger');
const { verifyToken } = require('../middleware/auth');
const prisma = require('../config/prisma');

let io = null;

async function initSocket(server) {
  io = new Server(server, {
    cors: { origin: env.frontendUrl, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000, pingInterval: 25000
  });

  if (env.redisUrl) {
    try {
      const pub = createClient(env.redisUrl);
      const sub = pub.duplicate();
      await Promise.all([pub.connect(), sub.connect()]);
      io.adapter(createAdapter(pub, sub));
      logger.info('🔗 Socket.IO Redis adapter connected');
    } catch (err) { logger.warn(`Redis adapter failed: ${err.message}`); }
  }

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const d = verifyToken(token);
      socket.userId = d.id;
      socket.userRole = d.role;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 ${socket.userRole}:${socket.userId} connected`);
    socket.join(`user_${socket.userId}`);
    socket.join(`role_${socket.userRole}`);

    socket.on('join_consultation', (id) => socket.join(`consultation_${id}`));
    socket.on('leave_consultation', (id) => socket.leave(`consultation_${id}`));
    socket.on('typing', ({ consultationId, typing }) => {
      socket.to(`consultation_${consultationId}`).emit('user_typing', {
        consultationId, userId: socket.userId, typing: !!typing
      });
    });
    socket.on('disconnect', () => logger.info(`🔌 ${socket.userId} disconnected`));
  });

  return io;
}

const getIO = () => io;
const emitToUser = (userId, event, payload) => io?.to(`user_${userId}`).emit(event, payload);
const emitToRole = (role, event, payload) => io?.to(`role_${role}`).emit(event, payload);
const emitDataUpdate = (type, data) => io?.emit('data-update', { type, data });
const emitNotification = (userId, payload) => emitToUser(userId, 'notification', payload);
const emitMessage = (consultationId, message) => io?.to(`consultation_${consultationId}`).emit('new_message', message);

async function notifyUser(userId, { title, message, type = 'system', link = null }) {
  const n = await prisma.notification.create({ data: { userId, title, message, type, link } });
  emitNotification(userId, n);
  return n;
}

async function notifyAdmins(payload) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  return Promise.all(admins.map((a) => notifyUser(a.id, payload)));
}

module.exports = {
  initSocket, getIO, emitToUser, emitToRole, emitDataUpdate,
  emitNotification, emitMessage, notifyUser, notifyAdmins
};
