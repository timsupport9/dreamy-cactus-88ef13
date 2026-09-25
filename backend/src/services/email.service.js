const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!env.email.host) { logger.warn('📧 SMTP not configured — emails logged only'); return null; }
  transporter = nodemailer.createTransport({
    host: env.email.host, port: env.email.port,
    secure: env.email.port === 465,
    auth: { user: env.email.user, pass: env.email.pass }
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();
  if (!tx) { logger.info(`[EMAIL MOCK] → ${to} | ${subject}`); return { mock: true }; }
  try {
    const info = await tx.sendMail({ from: env.email.from, to, subject, html, text: text || html.replace(/<[^>]+>/g, ' ') });
    logger.info(`📧 Email sent: ${info.messageId}`);
    return info;
  } catch (err) { logger.error(`Email failed: ${err.message}`); return { error: err.message }; }
}

const templates = {
  welcome: (name) => ({
    subject: 'Karibu ExpertHub 🎉',
    html: `<div style="font-family:system-ui;max-width:600px;margin:auto;padding:24px">
      <h1 style="color:#16a34a">Karibu ExpertHub, ${name}!</h1>
      <p>Your account is now active. Explore bootcamps and book consultations with verified experts.</p>
      <a href="${env.frontendUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Anza Sasa</a>
    </div>`
  }),
  accountApproved: (name) => ({
    subject: 'Your ExpertHub account is approved ✅',
    html: `<p>Hi ${name}, your account has been approved. You can now log in.</p>`
  }),
  accountSuspended: (name, reason) => ({
    subject: 'Account suspended',
    html: `<p>Hi ${name}, your account has been suspended.</p><p><strong>Reason:</strong> ${reason}</p>`
  }),
  passwordReset: (name, url) => ({
    subject: 'Reset your ExpertHub password',
    html: `<div style="font-family:system-ui;max-width:600px;margin:auto;padding:24px">
      <h1 style="color:#16a34a">Password Reset</h1>
      <p>Hi ${name},</p>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${url}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Reset Password</a>
    </div>`
  }),
  paymentReceived: (name, amount, receipt) => ({
    subject: 'Payment received — M-Pesa ✅',
    html: `<p>Hi ${name}, we received your M-Pesa payment of <strong>KES ${amount}</strong>.</p><p>Receipt: <strong>${receipt}</strong></p>`
  }),
  withdrawalProcessed: (name, amount) => ({
    subject: 'Withdrawal processed 💰',
    html: `<p>Hi ${name}, your withdrawal of <strong>KES ${amount}</strong> has been processed.</p>`
  })
};

async function sendTemplate(to, name, ...args) {
  const tpl = templates[name];
  if (!tpl) { logger.warn(`Unknown template: ${name}`); return; }
  const { subject, html } = tpl(...args);
  return sendMail({ to, subject, html });
}

module.exports = { sendMail, sendTemplate };
