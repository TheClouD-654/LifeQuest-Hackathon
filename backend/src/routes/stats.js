// Stats Routes
const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const { calculateLevel } = require('../services/rpgEngine');

// GET /api/stats
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [profile, attributes, questStats, activitySummaries, achievements] = await Promise.all([
      prisma.profile.findUnique({ where: { userId } }),
      prisma.attribute.findUnique({ where: { userId } }),
      prisma.questCompletion.count({ where: { userId } }),
      prisma.dailyActivitySummary.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      prisma.userAchievement.count({ where: { userId } }),
    ]);

    const totalQuests = await prisma.quest.count({ where: { userId, status: { not: 'DELETED' } } });
    const completedQuests = await prisma.quest.count({ where: { userId, status: 'COMPLETED' } });

    const levelData = calculateLevel(profile?.totalXp || 0);

    // Compute total activity by category
    const totals = activitySummaries.reduce((acc, s) => ({
      coding: acc.coding + s.codingMinutes,
      study: acc.study + s.studyMinutes,
      fitness: acc.fitness + s.fitnessMinutes,
      entertainment: acc.entertainment + s.entertainmentMinutes,
      social: acc.social + s.socialMinutes,
      work: acc.work + s.workMinutes,
      reading: acc.reading + s.readingMinutes,
      other: acc.other + s.otherMinutes,
    }), { coding: 0, study: 0, fitness: 0, entertainment: 0, social: 0, work: 0, reading: 0, other: 0 });

    res.json({
      profile: { ...profile, ...levelData },
      attributes,
      quests: {
        total: totalQuests,
        completed: completedQuests,
        completionRate: totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0,
      },
      streaks: {
        current: profile?.currentStreak || 0,
        longest: profile?.longestStreak || 0,
      },
      achievements: { unlocked: achievements },
      activityTotals: totals,
      recentActivity: activitySummaries.slice(0, 7),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
