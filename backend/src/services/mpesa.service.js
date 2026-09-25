const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../config/logger');
const { normalizeKenyanPhone } = require('../utils/helpers');

const BASE_URL = env.mpesa.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
const http = axios.create({ timeout: 15000, headers: { 'Content-Type': 'application/json' } });
http.interceptors.response.use(r => r, async err => {
  const cfg = err.config || {};
  cfg.__retry = (cfg.__retry || 0) + 1;
  if ((!err.response || err.response.status >= 500) && cfg.__retry <= 2) {
    await new Promise(resolve => setTimeout(resolve, 500 * cfg.__retry));
    return http(cfg);
  }
  return Promise.reject(err);
});
let cachedToken = null, tokenExpiry = 0;
async function getAccessToken() {
  if (!env.mpesa.enabled) throw new Error('M-Pesa disabled; simulator mode');
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const auth = Buffer.from(`${env.mpesa.consumerKey}:${env.mpesa.consumerSecret}`).toString('base64');
  const { data } = await http.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } });
  cachedToken = data.access_token; tokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}
function timestamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function simulateStkPush({ phone, amount, accountReference }) {
  const id = 'SIM-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  logger.info(`[SIMULATOR] STK request ${normalizeKenyanPhone(phone)} KES ${amount} (${accountReference})`);
  return {
    merchantRequestId: 'SIM-MERCHANT-' + crypto.randomBytes(4).toString('hex'),
    checkoutRequestId: id, responseCode: '0',
    responseDescription: 'Accepted (SIMULATOR)',
    customerMessage: `[SIMULATOR] No money charged. Use the simulator confirmation endpoint to complete.`
  };
}
async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  const normalizedPhone = normalizeKenyanPhone(phone), amountInt = Math.max(1, Math.round(Number(amount)));
  if (!env.mpesa.enabled) return simulateStkPush({ phone: normalizedPhone, amount: amountInt, accountReference });
  const token = await getAccessToken(), ts = timestamp();
  const password = Buffer.from(`${env.mpesa.shortcode}${env.mpesa.passkey}${ts}`).toString('base64');
  const payload = {
    BusinessShortCode: env.mpesa.shortcode, Password: password, Timestamp: ts,
    TransactionType: env.mpesa.transactionType, Amount: amountInt, PartyA: normalizedPhone,
    PartyB: env.mpesa.shortcode, PhoneNumber: normalizedPhone, CallBackURL: env.mpesa.callbackUrl,
    AccountReference: String(accountReference || 'ExpertHub').slice(0, 12),
    TransactionDesc: String(transactionDesc || 'Payment').slice(0, 13)
  };
  const { data } = await http.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload,
    { headers: { Authorization: `Bearer ${token}` } });
  return {
    merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode, responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage
  };
}
async function queryStkStatus(checkoutRequestId) {
  if (!env.mpesa.enabled) return { ResponseCode: '0', ResponseDescription: 'SIMULATOR — use mock-confirm', CheckoutRequestID: checkoutRequestId };
  const token = await getAccessToken(), ts = timestamp();
  const password = Buffer.from(`${env.mpesa.shortcode}${env.mpesa.passkey}${ts}`).toString('base64');
  const { data } = await http.post(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
    BusinessShortCode: env.mpesa.shortcode, Password: password, Timestamp: ts, CheckoutRequestID: checkoutRequestId
  }, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
module.exports = { getAccessToken, initiateStkPush, queryStkStatus };
