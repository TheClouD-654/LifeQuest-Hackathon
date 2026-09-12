// Achievements Routes
const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

// GET /api/achievements
router.get('/', requireAuth, async (req, res) => {
  try {
    const [achievements, userAchievements] = await Promise.all([
      prisma.achievement.findMany({ orderBy: { requirementValue: 'asc' } }),
      prisma.userAchievement.findMany({
        where: { userId: req.user.id },
        include: { achievement: true },
      }),
    ]);

    const unlockedMap = {};
    for (const ua of userAchievements) {
      unlockedMap[ua.achievementId] = ua.unlockedAt;
    }

    const result = achievements.map(a => ({
      ...a,
      unlocked: !!unlockedMap[a.id],
      unlockedAt: unlockedMap[a.id] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

module.exports = router;
