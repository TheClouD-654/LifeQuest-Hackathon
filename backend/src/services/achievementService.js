// ============================================================
// Achievement Service — Server-side achievement checking
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check and unlock achievements for a user after any significant event.
 * All checks are server-side.
 */
const checkAndUnlockAchievements = async (userId) => {
  const [profile, attributes, completionCount, userAchievements, achievements] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.attribute.findUnique({ where: { userId } }),
    prisma.questCompletion.count({ where: { userId } }),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
    prisma.achievement.findMany(),
  ]);

  const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId));
  const newlyUnlocked = [];

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;

    let shouldUnlock = false;

    switch (achievement.requirementType) {
      case 'QUEST_COUNT':
        shouldUnlock = completionCount >= achievement.requirementValue;
        break;
      case 'LEVEL':
        shouldUnlock = profile?.level >= achievement.requirementValue;
        break;
      case 'STREAK':
        shouldUnlock = profile?.currentStreak >= achievement.requirementValue;
        break;
      case 'LONGEST_STREAK':
        shouldUnlock = profile?.longestStreak >= achievement.requirementValue;
        break;
      case 'GOLD':
        shouldUnlock = profile?.gold >= achievement.requirementValue;
        break;
      case 'INTELLECT':
        shouldUnlock = attributes?.intellect >= achievement.requirementValue;
        break;
      case 'STRENGTH':
        shouldUnlock = attributes?.strength >= achievement.requirementValue;
        break;
      case 'DISCIPLINE':
        shouldUnlock = attributes?.discipline >= achievement.requirementValue;
        break;
      case 'TOTAL_XP':
        shouldUnlock = profile?.totalXp >= achievement.requirementValue;
        break;
    }

    if (shouldUnlock) {
      try {
        await prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        });
        newlyUnlocked.push(achievement);
      } catch (err) {
        // Already unlocked (race condition), ignore
      }
    }
  }

  return newlyUnlocked;
};

module.exports = { checkAndUnlockAchievements };
