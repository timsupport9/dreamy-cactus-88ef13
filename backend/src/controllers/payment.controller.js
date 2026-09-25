const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const mpesa = require('../services/mpesa.service');
const { applyCoupon, splitPayment, isValidKenyanPhone, normalizeKenyanPhone } = require('../utils/helpers');
const { notifyUser } = require('../services/socket.service');
const { sendTemplate } = require('../services/email.service');
const logger = require('../config/logger');

exports.initiatePayment = asyncHandler(async (req, res) => {
  const { consultationId, phone, couponCode } = req.body;

  if (!isValidKenyanPhone(phone))
    return res.status(400).json({ error: 'Enter a valid Kenyan phone (e.g. 0712345678)' });

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId }, include: { service: true }
  });
  if (!consultation || consultation.clientId !== req.user.id)
    return res.status(404).json({ error: 'Consultation not found' });
  if (consultation.paymentStatus === 'PAID')
    return res.status(400).json({ error: 'Already paid' });

  let coupon = null;
  if (couponCode) {
    coupon = await prisma.coupon.findFirst({
      where: { code: couponCode.toUpperCase(), isActive: true, expiresAt: { gt: new Date() } }
    });
  }

  const base = consultation.service?.price || consultation.amount || 0;
  const { amount: finalAmount, discount } = applyCoupon(base, coupon);

  const commissionConfig = await prisma.commissionConfig.findFirst({ where: { isActive: true } });
  const { commission, payout } = splitPayment(finalAmount, commissionConfig?.percentage ?? 20);

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id, consultationId: consultation.id,
      amount: finalAmount, currency: 'KES',
      commissionAmount: commission, expertPayout: payout,
      status: 'PENDING', method: 'MPESA',
      mpesaPhone: normalizeKenyanPhone(phone)
    }
  });

  try {
    const stk = await mpesa.initiateStkPush({
      phone, amount: finalAmount,
      accountReference: `EXP-${payment.id.slice(0, 8)}`,
      transactionDesc: 'ExpertHub Pay'
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutRequestId: stk.checkoutRequestId, merchantRequestId: stk.merchantRequestId }
    });

    if (coupon) {
      await prisma.consultation.update({
        where: { id: consultation.id },
        data: { couponId: coupon.id, discountAmount: discount, amount: finalAmount,
          commissionAmount: commission, expertPayout: payout }
      });
    }

    res.json({
      message: stk.customerMessage || 'STK push sent. Check your phone.',
      paymentId: payment.id, checkoutRequestId: stk.checkoutRequestId,
      amount: finalAmount, discount
    });
  } catch (err) {
    logger.error(`STK push failed: ${err.message}`);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    res.status(500).json({ error: err.response?.data?.errorMessage || err.message });
  }
});

exports.mpesaCallback = asyncHandler(async (req, res) => {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  logger.info('📱 M-Pesa callback: ' + JSON.stringify(body).slice(0, 500));

  const stk = body?.Body?.stkCallback;
  if (!stk) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { CheckoutRequestID, ResultCode } = stk;
  const payment = await prisma.payment.findFirst({ where: { checkoutRequestId: CheckoutRequestID } });
  if (!payment) {
    logger.warn(`Callback for unknown checkoutRequestId: ${CheckoutRequestID}`);
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (ResultCode === 0) {
    const meta = stk.CallbackMetadata?.Item || [];
    const get = (n) => meta.find((i) => i.Name === n)?.Value;
    const receipt = get('MpesaReceiptNumber');
    const amount = get('Amount');

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', mpesaReceipt: receipt, rawCallback: body }
      });
      await tx.consultation.update({
        where: { id: payment.consultationId },
        data: { paymentStatus: 'PAID', status: 'ASSIGNED' }
      });
      const c = await tx.consultation.findUnique({ where: { id: payment.consultationId } });
      if (c?.expertId) {
        await tx.expertProfile.update({
          where: { userId: c.expertId },
          data: { pendingPayout: { increment: payment.expertPayout } }
        });
      }
    });

    notifyUser(payment.userId, {
      title: 'Payment confirmed',
      message: `Your M-Pesa payment was successful. Receipt: ${receipt}`,
      type: 'payment'
    }).catch(() => {});

    const user = await prisma.user.findUnique({ where: { id: payment.userId } });
    if (user) sendTemplate(user.email, 'paymentReceived', user.name, amount, receipt).catch(() => {});
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', rawCallback: body } });
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

exports.queryPaymentStatus = asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.userId !== req.user.id)
    return res.status(404).json({ error: 'Payment not found' });
  if (payment.status === 'PAID') return res.json({ status: 'PAID', receipt: payment.mpesaReceipt });
  if (!payment.checkoutRequestId) return res.json({ status: payment.status });

  try {
    const r = await mpesa.queryStkStatus(payment.checkoutRequestId);
    res.json({ status: payment.status, mpesa: r });
  } catch (err) { res.json({ status: payment.status, error: err.message }); }
});

exports.validateCoupon = asyncHandler(async (req, res) => {
  const { code, amount = 0 } = req.query;
  if (!code) return res.status(400).json({ error: 'Coupon code required' });

  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) return res.status(404).json({ valid: false, error: 'Invalid coupon' });
  if (coupon.expiresAt < new Date()) return res.status(400).json({ valid: false, error: 'Coupon expired' });
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
    return res.status(400).json({ valid: false, error: 'Coupon limit reached' });

  const num = parseFloat(amount) || 0;
  if (num && coupon.minOrderAmount > num)
    return res.status(400).json({ valid: false, error: `Minimum order is KES ${coupon.minOrderAmount}` });

  const discount = coupon.discountType === 'PERCENTAGE'
    ? (num * coupon.discountValue) / 100
    : Math.min(coupon.discountValue, num);

  res.json({
    valid: true,
    coupon: { code: coupon.code, type: coupon.discountType, value: coupon.discountValue,
      discount: Math.round(discount * 100) / 100 }
  });
});

exports.myPayments = asyncHandler(async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { consultation: { select: { id: true, title: true, status: true } } }
  });
  res.json({ payments });
});
