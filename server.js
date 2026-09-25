require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./src/config/env');
const logger = require('./src/config/logger');
const prisma = require('./src/config/prisma');
const routes = require('./src/routes');
const { initSocket } = require('./src/services/socket.service');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({
  origin(origin, cb) {
    if (!origin || env.frontendOrigins.includes(origin)) return cb(null, true);
    logger.warn(`CORS blocked: ${origin}`);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(morgan(env.isProd ? 'combined' : 'dev'));

/* M-Pesa callback raw body (before json parser) */
app.post(
  '/api/payments/mpesa/callback',
  express.raw({ type: '*/*' }),
  require('./src/controllers/payment.controller').mpesaCallback
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR, {
  maxAge: env.isProd ? '1d' : 0,
  setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); }
}));

app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch (_) {}
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    env: env.nodeEnv, uptime: process.uptime(), currency: 'KES'
  });
});

app.use('/api', apiLimiter, routes);

app.get(/^\/(?!api|uploads).*/, (req, res) => {
  const idx = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.status(404).send('Frontend not found.');
});

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await prisma.$connect();
    logger.info('🗄️  MySQL connected');
    await initSocket(server);
    const PORT = process.env.PORT || env.port || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server on port ${PORT} (${env.nodeEnv})`);
      logger.info(`💰 Currency: KES  |  📱 M-Pesa: ${env.mpesa.env}`);
    });
  } catch (err) {
    logger.error(`Failed to start: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await prisma.$disconnect(); server.close(() => process.exit(0)); });
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });

start();
module.exports = { app, server };
