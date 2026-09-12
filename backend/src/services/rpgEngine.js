// ============================================================
// RPG Engine — Core Progression Logic
// Server-authoritative XP, leveling, streaks, attributes
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Level Formula ────────────────────────────────────────────────────────────
// XP_REQUIRED(level) = floor(100 * level^1.5)
// Level 1:  100 XP   Level 5:  1118 XP   Level 10: 3162 XP
const XP_FOR_LEVEL = (level) => Math.floor(100 * Math.pow(level, 1.5));

/**
 * Given total accumulated XP, calculate the current level and XP progress.
 */
const calculateLevel = (totalXp) => {
  let level = 1;
  let remaining = totalXp;

  while (true) {
    const needed = XP_FOR_LEVEL(level);
    if (remaining < needed) break;
    remaining -= needed;
    level += 1;
    if (level > 999) break; // Safety cap
  }

  const xpRequired = XP_FOR_LEVEL(level);
  return {
    level,
    currentXp: remaining,
    xpRequired,
    xpToNext: xpRequired - remaining,
    totalXp,
  };
};

// ─── Difficulty reward tables ──────────────────────────────────────────────────
const DIFFICULTY_REWARDS = {
  EASY:   { xpMin: 40,  xpMax: 70,  goldMin: 10, goldMax: 20 },
  MEDIUM: { xpMin: 70,  xpMax: 120, goldMin: 20, goldMax: 40 },
  HARD:   { xpMin: 120, xpMax: 200, goldMin: 40, goldMax: 60 },
  EPIC:   { xpMin: 200, xpMax: 350, goldMin: 60, goldMax: 100 },
};

/**
 * Deterministically calculate XP reward for a quest.
 * Based on difficulty + user level modifier.
 */
const calculateQuestXp = (difficulty, userLevel = 1) => {
  const table = DIFFICULTY_REWARDS[difficulty] || DIFFICULTY_REWARDS.MEDIUM;
  const base = Math.floor((table.xpMin + table.xpMax) / 2);
  // Small level scaling: higher levels get slightly more XP
  const scaling = 1 + (userLevel - 1) * 0.03;
  return Math.floor(base * scaling);
};

const calculateQuestGold = (difficulty, userLevel = 1) => {
  const table = DIFFICULTY_REWARDS[difficulty] || DIFFICULTY_REWARDS.MEDIUM;
  const base = Math.floor((table.goldMin + table.goldMax) / 2);
  const scaling = 1 + (userLevel - 1) * 0.02;
  return Math.floor(base * scaling);
};

// ─── Streak Logic ─────────────────────────────────────────────────────────────
const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const daysDiff = (date1, date2) => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
};

/**
 * Update streak based on last activity date.
 * Returns updated streak values.
 */
const updateStreak = (profile) => {
  const todayDate = today();
  const lastActivity = profile.lastActivityDate
    ? new Date(profile.lastActivityDate)
    : null;

  let newStreak = profile.currentStreak;

  if (!lastActivity) {
    // First ever activity
    newStreak = 1;
  } else {
    const diff = daysDiff(lastActivity, todayDate);
    if (diff === 0) {
      // Already logged today — don't increment
      newStreak = profile.currentStreak;
    } else if (diff === 1) {
      // Consecutive day
      newStreak = profile.currentStreak + 1;
    } else {
      // Missed one or more days — reset
      newStreak = 1;
    }
  }

  const longestStreak = Math.max(profile.longestStreak, newStreak);

  return {
    currentStreak: newStreak,
    longestStreak,
    lastActivityDate: todayDate,
  };
};

// ─── Titles based on level ────────────────────────────────────────────────────
const TITLES = [
  { level: 1,  title: 'Novice' },
  { level: 5,  title: 'Apprentice' },
  { level: 10, title: 'Adventurer' },
  { level: 15, title: 'Veteran' },
  { level: 20, title: 'Expert' },
  { level: 25, title: 'Master' },
  { level: 30, title: 'Grandmaster' },
  { level: 40, title: 'Legend' },
  { level: 50, title: 'Mythic' },
];

const getTitleForLevel = (level) => {
  let title = 'Novice';
  for (const t of TITLES) {
    if (level >= t.level) title = t.title;
  }
  return title;
};

// ─── Quest Completion — Server Authoritative ──────────────────────────────────
/**
 * Complete a quest. All reward calculations are server-side.
 * Uses Prisma transaction to ensure atomicity.
 *
 * @param {string} userId
 * @param {string} questId
 * @returns {object} Result with rewards, new character state, level-up info
 */
const completeQuest = async (userId, questId) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch quest and verify ownership
    const quest = await tx.quest.findUnique({
      where: { id: questId },
      include: { attributeRewards: true },
    });

    if (!quest) throw { status: 404, message: 'Quest not found.' };
    if (quest.userId !== userId) throw { status: 403, message: 'Access denied.' };
    if (quest.status === 'COMPLETED') throw { status: 409, message: 'Quest already completed.' };
    if (quest.status === 'DELETED') throw { status: 404, message: 'Quest not found.' };

    // 2. Check for duplicate completion (belt + suspenders with DB constraint)
    const existing = await tx.questCompletion.findUnique({
      where: { questId_userId: { questId, userId } },
    });
    if (existing) throw { status: 409, message: 'Quest already completed.' };

    // 3. Fetch profile and attributes
    const profile = await tx.profile.findUnique({ where: { userId } });
    const attributes = await tx.attribute.findUnique({ where: { userId } });
    if (!profile) throw { status: 400, message: 'Character not found.' };

    // 4. Server-side reward calculation (XP and Gold from DB quest record)
    const xpGained = quest.xpReward;
    const goldGained = quest.goldReward;

    // 5. Calculate new XP and level
    const newTotalXp = profile.totalXp + xpGained;
    const levelData = calculateLevel(newTotalXp);
    const oldLevel = profile.level;
    const newLevel = levelData.level;
    const leveledUp = newLevel > oldLevel;
    const newTitle = leveledUp ? getTitleForLevel(newLevel) : profile.title;

    // 6. Update streak
    const streakData = updateStreak(profile);

    // 7. Build attribute updates
    const attrUpdates = {};
    const attrRewards = {};
    for (const reward of quest.attributeRewards) {
      const attr = reward.attribute.toLowerCase();
      const current = attributes?.[attr] || 10;
      attrUpdates[attr] = current + reward.value;
      attrRewards[reward.attribute] = reward.value;
    }

    // 8. Create completion record
    await tx.questCompletion.create({
      data: { questId, userId },
    });

    // 9. Update quest status
    await tx.quest.update({
      where: { id: questId },
      data: { status: 'COMPLETED' },
    });

    // 10. Update profile
    const updatedProfile = await tx.profile.update({
      where: { userId },
      data: {
        totalXp: newTotalXp,
        currentXp: levelData.currentXp,
        level: newLevel,
        gold: profile.gold + goldGained,
        title: newTitle,
        ...streakData,
      },
    });

    // 11. Update attributes
    let updatedAttributes = attributes;
    if (Object.keys(attrUpdates).length > 0) {
      updatedAttributes = await tx.attribute.update({
        where: { userId },
        data: attrUpdates,
      });
    }

    return {
      questCompleted: true,
      rewards: {
        xp: xpGained,
        gold: goldGained,
        attributes: attrRewards,
      },
      character: {
        level: newLevel,
        currentXp: levelData.currentXp,
        xpRequired: levelData.xpRequired,
        totalXp: newTotalXp,
        gold: updatedProfile.gold,
        currentStreak: updatedProfile.currentStreak,
        longestStreak: updatedProfile.longestStreak,
      },
      levelUp: leveledUp,
      levelsGained: newLevel - oldLevel,
      newTitle: leveledUp ? newTitle : null,
      attributes: updatedAttributes,
    };
  });
};

module.exports = {
  calculateLevel,
  calculateQuestXp,
  calculateQuestGold,
  updateStreak,
  getTitleForLevel,
  completeQuest,
  XP_FOR_LEVEL,
};
