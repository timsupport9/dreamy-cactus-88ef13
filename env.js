require('dotenv').config();
const isProd = process.env.NODE_ENV === 'production';
const hardRequired = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of hardRequired) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
if (!process.env.JWT_REFRESH_SECRET) console.warn('JWT_REFRESH_SECRET missing; using JWT_SECRET. Set a separate secret for production.');
if (process.env.JWT_SECRET.length < 32) console.warn('JWT_SECRET is short; use a long random secret.');

const mpesaRequested = String(process.env.MPESA_ENABLED).toLowerCase() === 'true';
const mpesaHasCreds = !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET &&
  process.env.MPESA_PASSKEY && process.env.MPESA_CALLBACK_URL);
const mpesaEnabled = mpesaRequested && mpesaHasCreds;
if (mpesaRequested && !mpesaHasCreds) console.warn('M-Pesa credentials incomplete; simulator remains active.');
if (!mpesaEnabled) console.warn('M-Pesa simulator active; payments are simulated, not charged.');
if (isProd && mpesaEnabled && process.env.MPESA_ENV !== 'production') console.warn('M-Pesa is configured for sandbox.');

const frontendOrigins = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5000')
  .split(',').map(s => s.trim()).filter(Boolean);
module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development', isProd,
  port: parseInt(process.env.PORT, 10) || 5000,
  appUrl: process.env.APP_URL || 'http://localhost:5000',
  frontendUrl: frontendOrigins[0], frontendOrigins,
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  auth: {
    autoApproveUsers: String(process.env.AUTO_APPROVE_USERS).toLowerCase() !== 'false',
    devExposeResetUrl: !isProd && String(process.env.DEV_EXPOSE_RESET_URL).toLowerCase() === 'true'
  },
  mpesa: {
    enabled: mpesaEnabled, env: process.env.MPESA_ENV || 'sandbox',
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    passkey: process.env.MPESA_PASSKEY || '',
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
    transactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline'
  },
  email: {
    host: process.env.SMTP_HOST || null, port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || null, pass: process.env.SMTP_PASS || null,
    from: process.env.EMAIL_FROM || 'ExpertHub <no-reply@example.com>'
  },
  business: {
    defaultCommission: parseFloat(process.env.DEFAULT_COMMISSION_PERCENT) || 20,
    withdrawalHoldingDays: parseInt(process.env.WITHDRAWAL_HOLDING_DAYS, 10) || 7,
    minWithdrawal: parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT) || 200,
    currency: 'KES'
  },
  redisUrl: process.env.REDIS_URL || null
};
