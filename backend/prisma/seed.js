// ============================================================
// Database Seed — Development only
// Creates shop items, achievements, and optional demo data
// ============================================================
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Shop Items ─────────────────────────────────────────────────────────────
  const shopItems = [
    // Profile Frames
    { name: 'Cyber Frame', description: 'A sleek neon cyberpunk profile frame.', type: 'FRAME', price: 250, rarity: 'COMMON', assetKey: 'frame_cyber' },
    { name: 'Dragon Frame', description: 'Ancient dragon scales form this legendary frame.', type: 'FRAME', price: 800, rarity: 'RARE', assetKey: 'frame_dragon' },
    { name: 'Void Frame', description: 'From the void itself. Extremely rare.', type: 'FRAME', price: 2000, rarity: 'LEGENDARY', assetKey: 'frame_void' },
    { name: 'Scholar Frame', description: 'Ancient tomes and knowledge surround this frame.', type: 'FRAME', price: 400, rarity: 'UNCOMMON', assetKey: 'frame_scholar' },

    // Titles
    { name: 'Night Owl', description: 'For those who code after midnight.', type: 'TITLE', price: 400, rarity: 'UNCOMMON', assetKey: 'title_night_owl' },
    { name: 'The Relentless', description: 'You never stop. Ever.', type: 'TITLE', price: 600, rarity: 'RARE', assetKey: 'title_relentless' },
    { name: 'Quest Master', description: 'Awarded to those who complete 100 quests.', type: 'TITLE', price: 1000, rarity: 'EPIC', assetKey: 'title_quest_master' },
    { name: 'Legend', description: 'Very few achieve this title.', type: 'TITLE', price: 2500, rarity: 'LEGENDARY', assetKey: 'title_legend' },

    // Themes
    { name: 'Void Theme', description: 'Dark void with purple mystical accents.', type: 'THEME', price: 700, rarity: 'RARE', assetKey: 'theme_void' },
    { name: 'Crimson Theme', description: 'Deep red warrior theme.', type: 'THEME', price: 500, rarity: 'UNCOMMON', assetKey: 'theme_crimson' },
    { name: 'Aurora Theme', description: 'Northern lights inspired color scheme.', type: 'THEME', price: 900, rarity: 'EPIC', assetKey: 'theme_aurora' },

    // Badges
    { name: 'Scholar Badge', description: 'Displayed on your profile for intellectual excellence.', type: 'BADGE', price: 300, rarity: 'COMMON', assetKey: 'badge_scholar' },
    { name: 'Warrior Badge', description: 'For those who never skip fitness day.', type: 'BADGE', price: 300, rarity: 'COMMON', assetKey: 'badge_warrior' },
    { name: 'Streak Legend Badge', description: 'Achieved a 30-day streak.', type: 'BADGE', price: 1500, rarity: 'LEGENDARY', assetKey: 'badge_streak' },

    // Cosmetics
    { name: 'Neon Aura', description: 'A glowing neon aura surrounds your avatar.', type: 'COSMETIC', price: 800, rarity: 'RARE', assetKey: 'aura_neon' },
    { name: 'Golden Halo', description: 'Pure golden light radiates from your avatar.', type: 'COSMETIC', price: 1200, rarity: 'EPIC', assetKey: 'aura_golden' },
  ];

  for (const item of shopItems) {
    await prisma.shopItem.upsert({
      where: { name: item.name },
      update: item,
      create: item,
    });
  }
  console.log(`✅ Created ${shopItems.length} shop items`);

  // ─── Achievements ────────────────────────────────────────────────────────────
  const achievements = [
    { name: 'First Blood', description: 'Complete your first quest.', requirementType: 'QUEST_COUNT', requirementValue: 1, iconKey: 'sword' },
    { name: 'Getting Started', description: 'Complete 10 quests.', requirementType: 'QUEST_COUNT', requirementValue: 10, iconKey: 'shield' },
    { name: 'Quest Veteran', description: 'Complete 50 quests.', requirementType: 'QUEST_COUNT', requirementValue: 50, iconKey: 'star' },
    { name: 'Quest Master', description: 'Complete 100 quests.', requirementType: 'QUEST_COUNT', requirementValue: 100, iconKey: 'crown' },
    { name: 'Levelheaded', description: 'Reach Level 5.', requirementType: 'LEVEL', requirementValue: 5, iconKey: 'arrow-up' },
    { name: 'Rising Hero', description: 'Reach Level 10.', requirementType: 'LEVEL', requirementValue: 10, iconKey: 'zap' },
    { name: 'Ascendant', description: 'Reach Level 20.', requirementType: 'LEVEL', requirementValue: 20, iconKey: 'flame' },
    { name: 'Consistent', description: 'Maintain a 7-day streak.', requirementType: 'STREAK', requirementValue: 7, iconKey: 'fire' },
    { name: 'Unstoppable', description: 'Maintain a 30-day streak.', requirementType: 'STREAK', requirementValue: 30, iconKey: 'fire' },
    { name: 'Legendary', description: 'Achieve a 100-day streak.', requirementType: 'LONGEST_STREAK', requirementValue: 100, iconKey: 'trophy' },
    { name: 'Scholar', description: 'Reach 100 Intellect.', requirementType: 'INTELLECT', requirementValue: 100, iconKey: 'book' },
    { name: 'Iron Will', description: 'Reach 100 Strength.', requirementType: 'STRENGTH', requirementValue: 100, iconKey: 'dumbbell' },
    { name: 'Wealthy', description: 'Accumulate 1000 gold at once.', requirementType: 'GOLD', requirementValue: 1000, iconKey: 'coin' },
    { name: 'Gold Baron', description: 'Accumulate 5000 gold at once.', requirementType: 'GOLD', requirementValue: 5000, iconKey: 'coin' },
    { name: 'XP Grinder', description: 'Earn 10,000 total XP.', requirementType: 'TOTAL_XP', requirementValue: 10000, iconKey: 'star' },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { name: achievement.name },
      update: achievement,
      create: achievement,
    });
  }
  console.log(`✅ Created ${achievements.length} achievements`);

  // ─── Demo User (Development / Staging only — Never in Production) ──────────
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitlyAllowDemo = process.env.SEED_DEMO_ACCOUNT === 'true';

  if (!isProduction || explicitlyAllowDemo) {
    const demoEmail = 'demo@liferpg.dev';
    const existing = await prisma.user.findUnique({ where: { email: demoEmail } });

    if (!existing) {
      const passwordHash = await bcrypt.hash('demo1234', 12);
      const user = await prisma.user.create({
        data: { email: demoEmail, passwordHash },
      });

      await prisma.profile.create({
        data: {
          userId: user.id,
          username: 'DemoHero',
          level: 8,
          totalXp: 6420,
          currentXp: 420,
          gold: 1240,
          currentStreak: 7,
          longestStreak: 12,
          lastActivityDate: new Date(),
          avatar: 'scholar',
          class: 'SCHOLAR',
          title: 'Adventurer',
        },
      });

      await prisma.attribute.create({
        data: {
          userId: user.id,
          intellect: 91,
          strength: 72,
          discipline: 84,
          vitality: 63,
          focus: 88,
          social: 54,
        },
      });

      await prisma.userSettings.create({
        data: { userId: user.id, goals: 'CODING,STUDY,FITNESS' },
      });

      // Sample activity logs (last 7 days)
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        await prisma.dailyActivitySummary.create({
          data: {
            userId: user.id,
            date: dayDate,
            codingMinutes: 90 + Math.floor(Math.random() * 60),
            studyMinutes: 45 + Math.floor(Math.random() * 45),
            fitnessMinutes: i % 3 === 0 ? 0 : 20 + Math.floor(Math.random() * 20),
            entertainmentMinutes: 120 + Math.floor(Math.random() * 80),
            socialMinutes: 30,
            workMinutes: 60,
            readingMinutes: 15,
          },
        });
      }

      console.log(`✅ Demo user created: demo@liferpg.dev / demo1234`);
    } else {
      console.log('ℹ️  Demo user already exists');
    }
  }

  console.log('\n🎮 Seed complete!\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
