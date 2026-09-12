// ============================================================
// Leaderboard Routes — Hall of Champions
// Public rankings endpoint (no auth required)
// ============================================================
const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

// Valid sort columns
const VALID_SORTS = {
  level: { level: 'desc', totalXp: 'desc' },
  xp: { totalXp: 'desc', level: 'desc' },
  streak: { currentStreak: 'desc', level: 'desc' },
  gold: { gold: 'desc', level: 'desc' },
};

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const sortKey = VALID_SORTS[req.query.sort] ? req.query.sort : 'level';
    const orderBy = VALID_SORTS[sortKey];
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

    // Fetch top profiles with quest completion counts
    const profiles = await prisma.profile.findMany({
      orderBy: Object.entries(orderBy).map(([key, dir]) => ({ [key]: dir })),
      take: limit,
      select: {
        username: true,
        level: true,
        totalXp: true,
        currentXp: true,
        gold: true,
        currentStreak: true,
        longestStreak: true,
        avatar: true,
        class: true,
        title: true,
        country: true,
        userId: true,
        user: {
          select: {
            _count: {
              select: {
                questCompletions: true,
              },
            },
          },
        },
      },
    });

    // Build ranked leaderboard entries (no emails, no internal IDs exposed)
    const leaderboard = profiles.map((p, index) => ({
      rank: index + 1,
      username: p.username,
      avatar: p.avatar,
      class: p.class,
      title: p.title,
      country: p.country || null,
      level: p.level,
      totalXp: p.totalXp,
      gold: p.gold,
      currentStreak: p.currentStreak,
      longestStreak: p.longestStreak,
      questsCompleted: p.user?._count?.questCompletions || 0,
    }));

    // If user is authenticated, find their rank
    let myRank = null;
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.id) {
      const myProfile = await prisma.profile.findUnique({
        where: { userId: req.user.id },
        select: { username: true, level: true, totalXp: true, gold: true, currentStreak: true, avatar: true, class: true, title: true, country: true },
      });

      if (myProfile) {
        // Check if user is already in the list
        const existingIndex = leaderboard.findIndex(e => e.username === myProfile.username);
        if (existingIndex >= 0) {
          myRank = { ...leaderboard[existingIndex], isMe: true };
        } else {
          // Count how many are above this user for the current sort
          const sortField = sortKey === 'xp' ? 'totalXp' : sortKey === 'streak' ? 'currentStreak' : sortKey;
          const myValue = myProfile[sortField] || 0;

          const aboveCount = await prisma.profile.count({
            where: { [sortField]: { gt: myValue } },
          });

          const myQuestsCompleted = await prisma.questCompletion.count({
            where: { userId: req.user.id },
          });

          myRank = {
            rank: aboveCount + 1,
            username: myProfile.username,
            avatar: myProfile.avatar,
            class: myProfile.class,
            title: myProfile.title,
            country: myProfile.country || null,
            level: myProfile.level,
            totalXp: myProfile.totalXp,
            gold: myProfile.gold,
            currentStreak: myProfile.currentStreak,
            questsCompleted: myQuestsCompleted,
            isMe: true,
          };
        }
      }
    }

    res.json({
      leaderboard,
      sort: sortKey,
      total: await prisma.profile.count(),
      myRank,
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
