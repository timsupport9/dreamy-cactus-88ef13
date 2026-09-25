const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listCoupons = asyncHandler(async (req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ coupons });
});

exports.createCoupon = asyncHandler(async (req, res) => {
  const { code, description, discountType, discountValue, minOrderAmount = 0, maxUses, expiresAt } = req.body;
  const coupon = await prisma.coupon.create({
    data: {
      code: code.toUpperCase(), description,
      discountType: discountType || 'PERCENTAGE',
      discountValue: parseFloat(discountValue),
      minOrderAmount: parseFloat(minOrderAmount) || 0,
      maxUses: maxUses ? parseInt(maxUses, 10) : null,
      expiresAt: new Date(expiresAt)
    }
  });
  res.status(201).json({ coupon });
});

exports.updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: req.body });
  res.json({ coupon });
});

exports.deleteCoupon = asyncHandler(async (req, res) => {
  await prisma.coupon.delete({ where: { id: req.params.id } });
  res.json({ message: 'Coupon deleted' });
});
