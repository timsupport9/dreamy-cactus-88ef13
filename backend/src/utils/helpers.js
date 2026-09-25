const slugify = require('slugify');
const crypto = require('crypto');

const uid = () => crypto.randomUUID();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const makeSlug = (t) => slugify(t || '', { lower: true, strict: true, trim: true }).slice(0, 80);
const makeUniqueSlug = (t) => `${makeSlug(t)}-${Date.now().toString(36)}`;

const generateReferralCode = (name = 'USER') => {
  const prefix = String(name).replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() || 'USER';
  return `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
};

const splitPayment = (amount, commissionPercent = 20) => {
  const gross = round2(amount);
  const commission = round2((gross * commissionPercent) / 100);
  return { gross, commission, payout: round2(gross - commission) };
};

const applyCoupon = (amount, coupon) => {
  if (!coupon) return { amount: round2(amount), discount: 0 };
  const base = Number(amount) || 0;
  const discount = coupon.discountType === 'PERCENTAGE'
    ? (base * coupon.discountValue) / 100
    : Math.min(coupon.discountValue, base);
  return { amount: round2(base - discount), discount: round2(discount) };
};

const addDays = (d) => new Date(Date.now() + d * 86400000);
const sanitizeText = (t) => String(t || '').replace(/<script[\s\S]*?<\/script>/gi, '').trim();

function normalizeKenyanPhone(phone) {
  const c = String(phone || '').replace(/\D/g, '');
  if (c.startsWith('254')) return c;
  if (c.startsWith('0')) return `254${c.slice(1)}`;
  if (c.length === 9) return `254${c}`;
  return c;
}
const isValidKenyanPhone = (p) => /^254(7|1)\d{8}$/.test(normalizeKenyanPhone(p));
const formatKsh = (a) => `KES ${(Number(a) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

module.exports = {
  uid, round2, makeSlug, makeUniqueSlug, generateReferralCode,
  splitPayment, applyCoupon, addDays, sanitizeText,
  normalizeKenyanPhone, isValidKenyanPhone, formatKsh
};
