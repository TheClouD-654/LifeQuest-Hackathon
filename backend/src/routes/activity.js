// ============================================================
// Activity Routes
// POST /api/activity — log new activity
// GET  /api/activity — list activity logs
// GET  /api/activity/daily — today's summary
// GET  /api/activity/summary — 7-day summary
// ============================================================
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

const CATEGORIES = ['CODING', 'STUDY', 'FITNESS', 'READING', 'ENTERTAINMENT', 'SOCIAL', 'WORK', 'OTHER'];

const getTodayDate = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

// ─── GET /api/activity/daily ──────────────────────────────────────────────────
router.get('/daily', requireAuth, async (req, res) => {
  try {
    const todayDate = getTodayDate();

    const summary = await prisma.dailyActivitySummary.findUnique({
      where: { userId_date: { userId: req.user.id, date: todayDate } },
    });
    res.json(summary || {
      date: todayDate,
      codingMinutes: 0, studyMinutes: 0, fitnessMinutes: 0,
      entertainmentMinutes: 0, socialMinutes: 0, otherMinutes: 0,
      workMinutes: 0, readingMinutes: 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily activity' });
  }
});

// ─── GET /api/activity/summary ────────────────────────────────────────────────
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const summaries = await prisma.dailyActivitySummary.findMany({
      where: { userId: req.user.id, date: { gte: sevenDaysAgo } },
      orderBy: { date: 'desc' },
    });
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ─── GET /api/activity ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await prisma.activityLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// ─── POST /api/activity ───────────────────────────────────────────────────────
router.post('/', requireAuth, [
  body('category').isIn(CATEGORIES).withMessage('Invalid category'),
  body('durationMinutes').isInt({ min: 1, max: 1440 }).withMessage('Duration must be 1–1440 minutes'),
  body('description').optional().trim().isLength({ max: 255 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { category, durationMinutes, description } = req.body;
  const todayDate = getTodayDate();

  try {
    // Create activity log
    const log = await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        date: todayDate,
        category,
        description,
        durationMinutes: parseInt(durationMinutes),
      },
    });

    // Upsert daily summary
    const fieldMap = {
      CODING: 'codingMinutes',
      STUDY: 'studyMinutes',
      FITNESS: 'fitnessMinutes',
      ENTERTAINMENT: 'entertainmentMinutes',
      SOCIAL: 'socialMinutes',
      WORK: 'workMinutes',
      READING: 'readingMinutes',
      OTHER: 'otherMinutes',
    };
    const field = fieldMap[category] || 'otherMinutes';

    const existing = await prisma.dailyActivitySummary.findUnique({
      where: { userId_date: { userId: req.user.id, date: todayDate } },
    });

    if (existing) {
      await prisma.dailyActivitySummary.update({
        where: { userId_date: { userId: req.user.id, date: todayDate } },
        data: { [field]: existing[field] + parseInt(durationMinutes) },
      });
    } else {
      await prisma.dailyActivitySummary.create({
        data: {
          userId: req.user.id,
          date: todayDate,
          [field]: parseInt(durationMinutes),
        },
      });
    }

    // Generate insights
    const insights = await generateInsights(req.user.id, category, durationMinutes);

    res.status(201).json({ log, insights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// ─── Generate insights ────────────────────────────────────────────────────────
const generateInsights = async (userId, category, durationMinutes) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const summaries = await prisma.dailyActivitySummary.findMany({
    where: { userId, date: { gte: sevenDaysAgo } },
  });

  const insights = [];

  if (summaries.length >= 3) {
    const fieldMap = {
      CODING: 'codingMinutes', STUDY: 'studyMinutes', FITNESS: 'fitnessMinutes',
      ENTERTAINMENT: 'entertainmentMinutes', SOCIAL: 'socialMinutes',
    };
    const field = fieldMap[category];

    if (field) {
      const avg = summaries.reduce((s, d) => s + (d[field] || 0), 0) / summaries.length;
      if (category === 'ENTERTAINMENT' && durationMinutes > avg * 1.4) {
        insights.push({ type: 'warning', message: 'Your entertainment activity is above your recent average. Consider a Digital Monk quest tomorrow.' });
      } else if (durationMinutes > avg * 1.5) {
        insights.push({ type: 'success', message: `Great work! Your ${category.toLowerCase()} activity today is well above your average.` });
      } else if (durationMinutes < avg * 0.5 && avg > 20) {
        insights.push({ type: 'info', message: `Your ${category.toLowerCase()} activity is lower than usual today.` });
      }
    }
  }

  return insights;
};

module.exports = router;
