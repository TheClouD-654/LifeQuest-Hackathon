// ============================================================
// Mission Engine — Adaptive Rule-Based Quest Generator
// Generates personalized daily quests from activity data
// Does NOT depend on external AI APIs
// ============================================================
const { PrismaClient } = require('@prisma/client');
const { calculateQuestXp, calculateQuestGold } = require('./rpgEngine');
const prisma = new PrismaClient();

// ─── Quest Templates ─────────────────────────────────────────────────────────
// Each template defines a quest that can be generated based on rules
const QUEST_TEMPLATES = [
  // CODING
  {
    id: 'the_builder',
    title: 'The Builder',
    description: 'Complete {duration} minutes of focused coding.',
    type: 'PRODUCTIVITY',
    category: 'CODING',
    baseDuration: 45,
    attributeRewards: [{ attribute: 'intellect', value: 8 }, { attribute: 'focus', value: 5 }],
    tags: ['coding', 'productivity'],
    minDifficulty: 'MEDIUM',
  },
  {
    id: 'code_warrior',
    title: 'Code Warrior',
    description: 'Write code for {duration} minutes without interruption.',
    type: 'PRODUCTIVITY',
    category: 'CODING',
    baseDuration: 60,
    attributeRewards: [{ attribute: 'intellect', value: 10 }, { attribute: 'discipline', value: 4 }],
    tags: ['coding', 'focus'],
    minDifficulty: 'HARD',
  },
  {
    id: 'deep_work',
    title: 'Deep Work',
    description: 'Complete {duration} minutes of uninterrupted focused work.',
    type: 'PRODUCTIVITY',
    category: 'WORK',
    baseDuration: 90,
    attributeRewards: [{ attribute: 'focus', value: 8 }, { attribute: 'intellect', value: 5 }],
    tags: ['work', 'focus'],
    minDifficulty: 'HARD',
  },

  // FITNESS
  {
    id: 'iron_will',
    title: 'Iron Will',
    description: 'Complete a {duration}-minute workout session.',
    type: 'HEALTH',
    category: 'FITNESS',
    baseDuration: 20,
    attributeRewards: [{ attribute: 'strength', value: 7 }, { attribute: 'vitality', value: 5 }],
    tags: ['fitness', 'health'],
    minDifficulty: 'EASY',
  },
  {
    id: 'the_run',
    title: 'The Run',
    description: 'Go for a {duration}-minute run.',
    type: 'HEALTH',
    category: 'FITNESS',
    baseDuration: 30,
    attributeRewards: [{ attribute: 'vitality', value: 8 }, { attribute: 'discipline', value: 4 }],
    tags: ['fitness', 'cardio'],
    minDifficulty: 'MEDIUM',
  },
  {
    id: 'warrior_rising',
    title: 'Warrior Rising',
    description: 'Complete a full {duration}-minute strength training session.',
    type: 'HEALTH',
    category: 'FITNESS',
    baseDuration: 45,
    attributeRewards: [{ attribute: 'strength', value: 10 }, { attribute: 'vitality', value: 6 }],
    tags: ['fitness', 'strength'],
    minDifficulty: 'HARD',
  },

  // STUDY
  {
    id: 'scholar',
    title: 'The Scholar',
    description: 'Study for {duration} minutes without distractions.',
    type: 'PRODUCTIVITY',
    category: 'STUDY',
    baseDuration: 45,
    attributeRewards: [{ attribute: 'intellect', value: 8 }, { attribute: 'discipline', value: 5 }],
    tags: ['study', 'intellect'],
    minDifficulty: 'MEDIUM',
  },
  {
    id: 'knowledge_seeker',
    title: 'Knowledge Seeker',
    description: 'Dedicate {duration} minutes to learning something new.',
    type: 'HABIT',
    category: 'STUDY',
    baseDuration: 30,
    attributeRewards: [{ attribute: 'intellect', value: 6 }, { attribute: 'focus', value: 3 }],
    tags: ['study', 'learning'],
    minDifficulty: 'EASY',
  },

  // READING
  {
    id: 'bookworm',
    title: 'Bookworm',
    description: 'Read for {duration} minutes.',
    type: 'HABIT',
    category: 'READING',
    baseDuration: 20,
    attributeRewards: [{ attribute: 'intellect', value: 4 }],
    tags: ['reading', 'intellect'],
    minDifficulty: 'EASY',
  },
  {
    id: 'page_turner',
    title: 'Page Turner',
    description: 'Read for {duration} minutes and reflect on what you learned.',
    type: 'HABIT',
    category: 'READING',
    baseDuration: 30,
    attributeRewards: [{ attribute: 'intellect', value: 6 }, { attribute: 'discipline', value: 2 }],
    tags: ['reading', 'reflection'],
    minDifficulty: 'MEDIUM',
  },

  // DISCIPLINE / ENTERTAINMENT
  {
    id: 'digital_monk',
    title: 'Digital Monk',
    description: 'Keep your entertainment activity below your daily threshold today.',
    type: 'ACTIVITY',
    category: 'ENTERTAINMENT',
    baseDuration: 0,
    attributeRewards: [{ attribute: 'discipline', value: 5 }],
    tags: ['discipline', 'entertainment'],
    minDifficulty: 'MEDIUM',
  },
  {
    id: 'the_unplugged',
    title: 'The Unplugged',
    description: 'Spend {duration} minutes completely offline — no screens, no entertainment.',
    type: 'ACTIVITY',
    category: 'ENTERTAINMENT',
    baseDuration: 60,
    attributeRewards: [{ attribute: 'discipline', value: 8 }, { attribute: 'focus', value: 4 }],
    tags: ['discipline', 'focus'],
    minDifficulty: 'HARD',
  },

  // SOCIAL
  {
    id: 'social_quest',
    title: 'Social Pact',
    description: 'Spend {duration} minutes in meaningful social interaction.',
    type: 'HABIT',
    category: 'SOCIAL',
    baseDuration: 30,
    attributeRewards: [{ attribute: 'social', value: 8 }, { attribute: 'vitality', value: 2 }],
    tags: ['social'],
    minDifficulty: 'EASY',
  },

  // MEDITATION / MINDFULNESS
  {
    id: 'inner_peace',
    title: 'Inner Peace',
    description: 'Meditate or practice mindfulness for {duration} minutes.',
    type: 'HABIT',
    category: 'OTHER',
    baseDuration: 15,
    attributeRewards: [{ attribute: 'focus', value: 6 }, { attribute: 'discipline', value: 4 }],
    tags: ['meditation', 'focus'],
    minDifficulty: 'EASY',
  },

  // WORK
  {
    id: 'the_grind',
    title: 'The Grind',
    description: 'Complete {duration} minutes of productive work on your main project.',
    type: 'PRODUCTIVITY',
    category: 'WORK',
    baseDuration: 60,
    attributeRewards: [{ attribute: 'discipline', value: 6 }, { attribute: 'focus', value: 5 }],
    tags: ['work', 'productivity'],
    minDifficulty: 'MEDIUM',
  },

  // STREAK BONUS
  {
    id: 'streak_defender',
    title: 'Streak Defender',
    description: 'Maintain your streak — complete at least one meaningful activity today.',
    type: 'HABIT',
    category: 'OTHER',
    baseDuration: 0,
    attributeRewards: [{ attribute: 'discipline', value: 5 }, { attribute: 'vitality', value: 3 }],
    tags: ['streak'],
    minDifficulty: 'EASY',
  },

  // EPIC CHALLENGES
  {
    id: 'the_legend',
    title: 'The Legend',
    description: 'Complete an epic {duration}-minute productivity session across any category.',
    type: 'PRODUCTIVITY',
    category: 'OTHER',
    baseDuration: 120,
    attributeRewards: [
      { attribute: 'intellect', value: 6 },
      { attribute: 'discipline', value: 6 },
      { attribute: 'focus', value: 6 },
    ],
    tags: ['epic', 'productivity'],
    minDifficulty: 'EPIC',
  },
];

// ─── Difficulty scaling ───────────────────────────────────────────────────────
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EPIC'];

const scaleDifficulty = (base, completionRate, streak, level) => {
  let idx = DIFFICULTIES.indexOf(base);

  if (completionRate < 0.4) idx = Math.max(0, idx - 1);
  if (completionRate > 0.85) idx = Math.min(3, idx + 1);
  if (streak >= 7) idx = Math.min(3, idx + 1);
  if (streak >= 30) idx = Math.min(3, idx + 1);
  if (level >= 20) idx = Math.min(3, idx + 1);

  return DIFFICULTIES[idx] || 'MEDIUM';
};

const scaleDuration = (baseDuration, difficulty, level) => {
  if (baseDuration === 0) return 0;
  const multipliers = { EASY: 0.75, MEDIUM: 1.0, HARD: 1.5, EPIC: 2.0 };
  const m = multipliers[difficulty] || 1.0;
  const scaled = Math.round(baseDuration * m);
  // Don't make it impossible
  return Math.min(scaled, baseDuration * 2.5);
};

// ─── Get 7-day activity averages ─────────────────────────────────────────────
const get7DayAverages = async (userId) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const summaries = await prisma.dailyActivitySummary.findMany({
    where: {
      userId,
      date: { gte: sevenDaysAgo },
    },
  });

  if (summaries.length === 0) {
    return {
      coding: 0, study: 0, fitness: 0,
      entertainment: 0, social: 0, other: 0, work: 0, reading: 0,
    };
  }

  const total = {
    coding: 0, study: 0, fitness: 0,
    entertainment: 0, social: 0, other: 0, work: 0, reading: 0,
  };

  for (const s of summaries) {
    total.coding += s.codingMinutes || 0;
    total.study += s.studyMinutes || 0;
    total.fitness += s.fitnessMinutes || 0;
    total.entertainment += s.entertainmentMinutes || 0;
    total.social += s.socialMinutes || 0;
    total.other += s.otherMinutes || 0;
    total.work += s.workMinutes || 0;
    total.reading += s.readingMinutes || 0;
  }

  const count = summaries.length;
  return {
    coding: Math.round(total.coding / count),
    study: Math.round(total.study / count),
    fitness: Math.round(total.fitness / count),
    entertainment: Math.round(total.entertainment / count),
    social: Math.round(total.social / count),
    other: Math.round(total.other / count),
    work: Math.round(total.work / count),
    reading: Math.round(total.reading / count),
  };
};

// ─── Get yesterday's activity ─────────────────────────────────────────────────
const getYesterdayActivity = async (userId) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  return await prisma.dailyActivitySummary.findUnique({
    where: { userId_date: { userId, date: yDate } },
  });
};

// ─── Get recent completion rate ────────────────────────────────────────────────
const getCompletionRate = async (userId) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [total, completed] = await Promise.all([
    prisma.quest.count({
      where: {
        userId,
        source: 'generated',
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.quest.count({
      where: {
        userId,
        source: 'generated',
        status: 'COMPLETED',
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  if (total === 0) return 0.5; // Default 50% if no data
  return completed / total;
};

// ─── Score and select templates ────────────────────────────────────────────────
const scoreTemplates = (templates, context) => {
  const { avg7Day, yesterday, userGoals, attributes } = context;
  const scores = [];

  for (const tmpl of templates) {
    let score = 0;

    // User goals boost
    const goalMap = {
      CODING: 'coding', STUDY: 'study', FITNESS: 'fitness',
      READING: 'reading', PRODUCTIVITY: 'work', SOCIAL: 'social',
      DISCIPLINE: null, BALANCE: null,
    };

    if (userGoals && userGoals.some(g => {
      const mapped = goalMap[g];
      return tmpl.tags.includes(g.toLowerCase()) || (mapped && tmpl.tags.includes(mapped));
    })) {
      score += 3;
    }

    // Low activity areas need quests
    const activityMap = {
      CODING: avg7Day.coding,
      STUDY: avg7Day.study,
      FITNESS: avg7Day.fitness,
      READING: avg7Day.reading,
      WORK: avg7Day.work,
      SOCIAL: avg7Day.social,
      ENTERTAINMENT: avg7Day.entertainment,
    };

    const catActivity = activityMap[tmpl.category] ?? 60;
    if (catActivity < 30) score += 4;
    else if (catActivity < 60) score += 2;

    // Weak attribute boost
    const attrMap = {
      intellect: attributes?.intellect || 10,
      strength: attributes?.strength || 10,
      discipline: attributes?.discipline || 10,
      vitality: attributes?.vitality || 10,
      focus: attributes?.focus || 10,
      social: attributes?.social || 10,
    };

    for (const ar of tmpl.attributeRewards) {
      const attrVal = attrMap[ar.attribute.toLowerCase()] || 10;
      if (attrVal < 30) score += 3;
      else if (attrVal < 50) score += 1;
    }

    // Entertainment excess generates Digital Monk
    if (tmpl.id === 'digital_monk' && yesterday) {
      if (yesterday.entertainmentMinutes > (avg7Day.entertainment * 1.4 + 30)) {
        score += 5;
      }
    }

    scores.push({ tmpl, score });
  }

  // Sort by score descending, shuffle ties
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });

  return scores;
};

// ─── Main Generator Function ──────────────────────────────────────────────────
/**
 * Generate 3–5 daily quests for a user based on their activity and context.
 * Stores them in the database and returns them.
 */
const generateDailyMissions = async (userId) => {
  // Gather context
  const [profile, attributes, settings, avg7Day, yesterday, completionRate] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.attribute.findUnique({ where: { userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
    get7DayAverages(userId),
    getYesterdayActivity(userId),
    getCompletionRate(userId),
  ]);

  const userGoals = settings?.goals ? settings.goals.split(',') : ['STUDY', 'CODING'];
  const level = profile?.level || 1;
  const streak = profile?.currentStreak || 0;

  const context = {
    avg7Day,
    yesterday,
    userGoals,
    attributes,
    level,
    streak,
    completionRate,
  };

  // Score all templates
  const scored = scoreTemplates(QUEST_TEMPLATES, context);

  // Select top 3–5 (avoid duplicates)
  const selectedTemplates = [];
  const usedCategories = new Set();
  const targetCount = streak >= 7 ? 5 : 4; // More quests for high streaks

  for (const { tmpl } of scored) {
    if (selectedTemplates.length >= targetCount) break;

    // Limit to 2 per category
    const catCount = selectedTemplates.filter(t => t.category === tmpl.category).length;
    if (catCount >= 2) continue;

    selectedTemplates.push(tmpl);
  }

  // Minimum 3
  while (selectedTemplates.length < 3 && scored.length > selectedTemplates.length) {
    const remaining = scored
      .map(s => s.tmpl)
      .filter(t => !selectedTemplates.includes(t));
    if (remaining.length === 0) break;
    selectedTemplates.push(remaining[0]);
  }

  // Create quests in DB
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  dueDate.setHours(23, 59, 59, 999);

  const createdQuests = [];

  for (const tmpl of selectedTemplates) {
    const difficulty = scaleDifficulty(
      tmpl.minDifficulty,
      completionRate,
      streak,
      level
    );
    const duration = scaleDuration(tmpl.baseDuration, difficulty, level);
    const xpReward = calculateQuestXp(difficulty, level);
    const goldReward = calculateQuestGold(difficulty, level);

    // Replace {duration} placeholder in description
    const description = tmpl.description.replace('{duration}', duration || '');

    try {
      const quest = await prisma.quest.create({
        data: {
          userId,
          title: tmpl.title,
          description,
          type: tmpl.type,
          category: tmpl.category,
          difficulty,
          xpReward,
          goldReward,
          status: 'ACTIVE',
          source: 'generated',
          dueDate,
          attributeRewards: {
            create: tmpl.attributeRewards.map(ar => ({
              attribute: ar.attribute,
              value: ar.value,
            })),
          },
        },
        include: { attributeRewards: true },
      });
      createdQuests.push(quest);
    } catch (err) {
      console.error(`Failed to create quest ${tmpl.id}:`, err);
    }
  }

  return createdQuests;
};

/**
 * Get today's generated missions, generating them if they don't exist yet.
 */
const getTodaysMissions = async (userId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.quest.findMany({
    where: {
      userId,
      source: 'generated',
      createdAt: { gte: todayStart, lte: todayEnd },
      status: { not: 'DELETED' },
    },
    include: { attributeRewards: true, completions: { where: { userId } } },
    orderBy: { createdAt: 'asc' },
  });

  if (existing.length > 0) {
    return existing;
  }

  return await generateDailyMissions(userId);
};

module.exports = { generateDailyMissions, getTodaysMissions };
