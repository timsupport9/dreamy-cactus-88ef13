const prisma = require('../config/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { makeUniqueSlug } = require('../utils/helpers');

exports.getBootcamps = asyncHandler(async (req, res) => {
  const bootcamps = await prisma.bootcamp.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'desc' } });
  res.json({ bootcamps });
});

exports.getShortCourses = asyncHandler(async (req, res) => {
  const courses = await prisma.shortCourse.findMany({ where: { status: 'published' }, orderBy: { createdAt: 'desc' } });
  res.json({ courses });
});

exports.getEvents = asyncHandler(async (req, res) => {
  const events = await prisma.event.findMany({ where: { status: 'active' }, orderBy: { startDate: 'asc' } });
  res.json({ events });
});

exports.createBootcamp = asyncHandler(async (req, res) => {
  const bootcamp = await prisma.bootcamp.create({
    data: { ...req.body, slug: makeUniqueSlug(req.body.title), startDate: new Date(req.body.startDate) }
  });
  res.status(201).json({ bootcamp });
});

exports.createShortCourse = asyncHandler(async (req, res) => {
  const course = await prisma.shortCourse.create({
    data: { ...req.body, slug: makeUniqueSlug(req.body.title) }
  });
  res.status(201).json({ course });
});

exports.enroll = asyncHandler(async (req, res) => {
  const { programType, programId } = req.body;
  const existing = await prisma.enrollment.findUnique({
    where: { userId_programType_programId: { userId: req.user.id, programType, programId } }
  });
  if (existing) return res.status(400).json({ error: 'Already enrolled' });

  const enrollment = await prisma.enrollment.create({ data: { userId: req.user.id, programType, programId } });
  res.status(201).json({ enrollment });
});

exports.myEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await prisma.enrollment.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  res.json({ enrollments });
});
