// ============================================================
// Community Seed — make the leaderboard look alive
// 1) Purges test-junk accounts created by tests/verify-*.js
// 2) Seeds believable community players with consistent stats
//
// Idempotent: safe to run repeatedly. Players are matched by
// exact username, so re-running refreshes their stats.
// ============================================================
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ─── 1. Purge junk left behind by automated tests ────────────────
// Exact prefixes used by tests/verify-*.js and test-live-flow.js.
// DemoHero (seed demo account) is NOT matched by these prefixes.
const JUNK_PREFIXES = ['Rival_', 'Renowned_', 'champ_', 'Hero_'];

async function purgeJunk() {
  let removed = 0;
  for (const prefix of JUNK_PREFIXES) {
    const res = await prisma.user.deleteMany({
      where: { profile: { username: { startsWith: prefix } } },
    });
    removed += res.count;
  }
  return removed;
}

// ─── 2. Believable community players ─────────────────────────────
// Stats form a natural-looking progression curve, not round numbers.
const COMMUNITY = [
  // ---- Top tier (podium) ----
  { username: 'AaravSharma',  country: 'IN', level: 42, gold: 8420,  streak: 31, longest: 45, avatar: 'mage',     cls: 'SCHOLAR',  title: 'Legend',
    attrs: { intellect: 187, strength: 88,  discipline: 165, vitality: 92,  focus: 178, social: 76 },
    quests: 214, weeks: 26 },

  { username: 'NovaStrike',   country: 'US', level: 38, gold: 6980,  streak: 24, longest: 38, avatar: 'warrior',  cls: 'WARRIOR',  title: 'Grandmaster',
    attrs: { intellect: 121, strength: 176, discipline: 158, vitality: 169, focus: 134, social: 95 },
    quests: 187, weeks: 24 },

  { username: 'LunaEcho',     country: 'GB', level: 35, gold: 5240,  streak: 19, longest: 27, avatar: 'rogue',    cls: 'ROGUE',    title: 'Grandmaster',
    attrs: { intellect: 158, strength: 74,  discipline: 142, vitality: 98,  focus: 166, social: 121 },
    quests: 166, weeks: 22 },

  // ---- High tier ----
  { username: 'Kenji_Tanaka', country: 'JP', level: 29, gold: 4110,  streak: 15, longest: 31, avatar: 'paladin',  cls: 'GUARDIAN', title: 'Master',
    attrs: { intellect: 132, strength: 118, discipline: 149, vitality: 127, focus: 121, social: 88 },
    quests: 141, weeks: 20 },

  { username: 'ZaraMalik',    country: 'IN', level: 27, gold: 3870,  streak: 12, longest: 22, avatar: 'rogue',    cls: 'ROGUE',    title: 'Master',
    attrs: { intellect: 144, strength: 92,  discipline: 131, vitality: 106, focus: 138, social: 112 },
    quests: 128, weeks: 18 },

  { username: 'DiegoRamirez', country: 'MX', level: 25, gold: 3240,  streak: 9,  longest: 18, avatar: 'warrior',  cls: 'WARRIOR',  title: 'Master',
    attrs: { intellect: 98,  strength: 152, discipline: 119, vitality: 141, focus: 102, social: 97 },
    quests: 117, weeks: 17 },

  { username: 'SofiaRossi',   country: 'IT', level: 23, gold: 2960,  streak: 14, longest: 21, avatar: 'mage',     cls: 'SCHOLAR',  title: 'Expert',
    attrs: { intellect: 139, strength: 71,  discipline: 118, vitality: 89,  focus: 127, social: 104 },
    quests: 104, weeks: 16 },

  { username: 'EthanBrooks',  country: 'CA', level: 21, gold: 2510,  streak: 6,  longest: 15, avatar: 'guardian', cls: 'GUARDIAN', title: 'Expert',
    attrs: { intellect: 106, strength: 123, discipline: 108, vitality: 132, focus: 98,  social: 84 },
    quests: 96,  weeks: 15 },

  // ---- Mid tier ----
  { username: 'PriyaNair',    country: 'IN', level: 18, gold: 2140,  streak: 11, longest: 17, avatar: 'scholar',  cls: 'SCHOLAR',  title: 'Veteran',
    attrs: { intellect: 124, strength: 66,  discipline: 102, vitality: 78,  focus: 113, social: 92 },
    quests: 83,  weeks: 13 },

  { username: 'OskarNowak',   country: 'PL', level: 16, gold: 1890,  streak: 4,  longest: 12, avatar: 'rogue',    cls: 'ROGUE',    title: 'Veteran',
    attrs: { intellect: 97,  strength: 104, discipline: 88,  vitality: 93,  focus: 91,  social: 72 },
    quests: 71,  weeks: 12 },

  { username: 'AmaraOkafor',  country: 'NG', level: 14, gold: 1620,  streak: 8,  longest: 14, avatar: 'mage',     cls: 'SCHOLAR',  title: 'Veteran',
    attrs: { intellect: 111, strength: 74,  discipline: 96,  vitality: 82,  focus: 104, social: 99 },
    quests: 62,  weeks: 10 },

  { username: 'LucasSilva',   country: 'BR', level: 12, gold: 1340,  streak: 3,  longest: 9,  avatar: 'warrior',  cls: 'WARRIOR',  title: 'Adventurer',
    attrs: { intellect: 84,  strength: 112, discipline: 79,  vitality: 103, focus: 81,  social: 68 },
    quests: 51,  weeks: 9 },

  { username: 'MeiChen',      country: 'CN', level: 11, gold: 1170,  streak: 7,  longest: 11, avatar: 'scholar',  cls: 'SCHOLAR',  title: 'Adventurer',
    attrs: { intellect: 96,  strength: 82,  discipline: 91,  vitality: 87,  focus: 99,  social: 76 },
    quests: 44,  weeks: 8 },

  // ---- Fresh-ish tier (relatable beginners) ----
  { username: 'FinnLarsen',   country: 'DK', level: 8,  gold: 940,   streak: 5,  longest: 8,  avatar: 'scholar',  cls: 'SCHOLAR',  title: 'Apprentice',
    attrs: { intellect: 71,  strength: 58,  discipline: 66,  vitality: 62,  focus: 74,  social: 55 },
    quests: 31,  weeks: 6 },

  { username: 'IslaMurphy',   country: 'IE', level: 6,  gold: 720,   streak: 2,  longest: 6,  avatar: 'guardian', cls: 'GUARDIAN', title: 'Apprentice',
    attrs: { intellect: 62,  strength: 69,  discipline: 58,  vitality: 71,  focus: 59,  social: 64 },
    quests: 22,  weeks: 4 },

  { username: 'TariqHassan',  country: 'EG', level: 5,  gold: 580,   streak: 4,  longest: 7,  avatar: 'rogue',    cls: 'ROGUE',    title: 'Apprentice',
    attrs: { intellect: 58,  strength: 63,  discipline: 54,  vitality: 60,  focus: 57,  social: 61 },
    quests: 17,  weeks: 3 },

  { username: 'GraceKim',     country: 'KR', level: 4,  gold: 460,   streak: 1,  longest: 4,  avatar: 'mage',     cls: 'SCHOLAR',  title: 'Novice',
    attrs: { intellect: 54,  strength: 47,  discipline: 51,  vitality: 49,  focus: 56,  social: 52 },
    quests: 12,  weeks: 2 },

  { username: 'NoahWilliams', country: 'AU', level: 3,  gold: 340,   streak: 2,  longest: 3,  avatar: 'warrior',  cls: 'WARRIOR',  title: 'Novice',
    attrs: { intellect: 48,  strength: 55,  discipline: 46,  vitality: 52,  focus: 47,  social: 44 },
    quests: 8,   weeks: 2 },

  { username: 'AnaPetrova',   country: 'RO', level: 2,  gold: 260,   streak: 1,  longest: 2,  avatar: 'warrior',  cls: 'WARRIOR',  title: 'Novice',
    attrs: { intellect: 44,  strength: 42,  discipline: 41,  vitality: 43,  focus: 45,  social: 40 },
    quests: 5,   weeks: 1 },
];

const PASSWORD = 'quest1234';
const VALID_CLASSES = new Set(['SCHOLAR', 'WARRIOR', 'GUARDIAN', 'ROGUE']);

const xpForLevel = (level) => Math.floor(100 * Math.pow(level, 1.5));

// Total XP required to REACH a given level (sum of per-level costs up to level-1)
const totalXpForLevel = (level) => {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpForLevel(l);
  return sum;
};

async function seedPlayer(p) {
  const email = `${p.username.toLowerCase()}@community.lifequest`;
  const existing = await prisma.user.findUnique({ where: { email } });

  // totalXp derived from level so profile.level and profile.totalXp agree with rpgEngine math
  const totalXp = totalXpForLevel(p.level) + Math.floor(xpForLevel(p.level) * 0.12);

  const profileData = {
    username: p.username,
    level: p.level,
    currentXp: Math.floor(xpForLevel(p.level) * 0.12),
    gold: p.gold,
    currentStreak: p.streak,
    longestStreak: Math.max(p.longest, p.streak),
    lastActivityDate: new Date(Date.now() - Math.floor(Math.random() * 20) * 3600000),
    avatar: p.avatar,
    class: VALID_CLASSES.has(p.cls) ? p.cls : 'SCHOLAR',
    title: p.title,
    country: p.country,
  };

  let userId;
  if (existing) {
    userId = existing.id;
    await prisma.profile.update({ where: { userId }, data: { ...profileData, totalXp } });
    await prisma.attribute.update({
      where: { userId },
      data: p.attrs,
    }).catch(() => {}); // attributes row may not exist yet on first pass
    // Re-seed history cleanly: drop previously seeded quests (cascades to completions)
    await prisma.quest.deleteMany({
      where: { userId, description: 'Seeded historical quest' },
    });
  } else {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });
    userId = user.id;

    await prisma.profile.create({
      data: { userId, ...profileData, totalXp },
    });

    await prisma.attribute.create({
      data: { userId, ...p.attrs },
    });

    await prisma.userSettings.create({
      data: {
        userId,
        goals: 'CODING,STUDY',
        activityTrackingEnabled: true,
      },
    });
  }

  // Quest completion history (drives the "Quests" column + achievements).
  // questCompletions has a FK to Quest, so each completion gets a real (COMPLETED) quest.
  // Uses createMany batches — sequential inserts over a remote DB are far too slow.
  if (p.quests > 0) {
    const completionStart = Date.now() - p.weeks * 7 * 24 * 3600000;
    const span = p.weeks * 7 * 24 * 3600000;
    const questRows = [];
    for (let i = 0; i < p.quests; i++) {
      questRows.push({
        userId,
        title: `Community quest ${i + 1}`,
        description: 'Seeded historical quest',
        xpReward: 80,
        goldReward: 30,
        status: 'COMPLETED',
        createdAt: new Date(completionStart + Math.random() * span),
      });
    }
    await prisma.quest.createMany({ data: questRows });
    const createdQuests = await prisma.quest.findMany({
      where: { userId, description: 'Seeded historical quest' },
      select: { id: true, createdAt: true },
    });
    await prisma.questCompletion.createMany({
      data: createdQuests.map((q) => ({
        questId: q.id,
        userId,
        completedAt: new Date(q.createdAt.getTime() + 2 * 3600000),
      })),
    });
  }

  return userId;
}

async function main() {
  console.log('🧹 Purging test junk accounts...');
  const removed = await purgeJunk();
  console.log(`   Removed ${removed} junk account(s)`);

  console.log('🌍 Seeding community players...');
  for (const p of COMMUNITY) {
    await seedPlayer(p);
    console.log(`   ✅ ${p.username} — Lv ${p.level}, ${p.country}`);
  }

  const total = await prisma.profile.count();
  console.log(`\n📊 Done. Total profiles in DB: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
