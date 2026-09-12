// ============================================================
// Profile Routes — GET /api/profile, PATCH /api/profile
// POST /api/profile/create (character creation)
// ============================================================
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const { calculateLevel } = require('../services/rpgEngine');

// ─── Avatar validation ─────────────────────────────────────────────────────────
// Either a built-in avatar id or a base64 data-URL image (custom upload / camera).
// The strict char class also guarantees the value is HTML-safe to interpolate.
const BUILTIN_AVATARS = ['scholar', 'warrior', 'rogue', 'guardian', 'mage', 'ranger', 'paladin', 'assassin'];
const CUSTOM_AVATAR_MAX_LENGTH = 300_000; // ~225KB binary → ~80KB after client downscale
const isValidAvatar = (value) =>
  BUILTIN_AVATARS.includes(value) ||
  (
    value.length <= CUSTOM_AVATAR_MAX_LENGTH &&
    /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
const avatarValidator =
  body('avatar').optional({ nullable: true }).isString().custom(isValidAvatar)
    .withMessage('Avatar must be a built-in avatar or an image up to ~300KB.');

// ─── GET /api/profile ─────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const [profile, attributes, user, userSettings, totalQuests, completedQuests, achievementsUnlocked, equippedInventory] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: req.user.id } }),
      prisma.attribute.findUnique({ where: { userId: req.user.id } }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, googleId: true, createdAt: true },
      }),
      prisma.userSettings.findUnique({ where: { userId: req.user.id } }),
      prisma.quest.count({ where: { userId: req.user.id, status: { not: 'DELETED' } } }),
      prisma.quest.count({ where: { userId: req.user.id, status: 'COMPLETED' } }),
      prisma.userAchievement.count({ where: { userId: req.user.id } }),
      prisma.inventory.findMany({
        where: { userId: req.user.id, equipped: true },
        include: { item: true },
      }),
    ]);

    if (!profile) return res.status(404).json({ error: 'Profile not found', code: 'NO_PROFILE' });

    const levelData = calculateLevel(profile.totalXp);

    const goalsList = userSettings?.goals
      ? (Array.isArray(userSettings.goals) ? userSettings.goals : userSettings.goals.split(',').map(g => g.trim()).filter(Boolean))
      : ['CODING', 'STUDY'];

    res.json({
      ...profile,
      ...levelData,
      attributes: attributes || null,
      account: {
        id: user?.id,
        email: user?.email,
        authMethod: user?.googleId ? 'Google' : 'Email',
        createdAt: user?.createdAt,
      },
      settings: {
        theme: userSettings?.theme || 'dark',
        notificationsEnabled: userSettings?.notificationsEnabled ?? true,
        activityTrackingEnabled: userSettings?.activityTrackingEnabled ?? true,
        goals: goalsList,
      },
      stats: {
        totalQuests,
        completedQuests,
        completionRate: totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0,
        achievementsUnlocked,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        totalXp: profile.totalXp,
        gold: profile.gold,
      },
      equippedItems: equippedInventory.map(inv => ({
        id: inv.id,
        itemId: inv.itemId,
        name: inv.item.name,
        type: inv.item.type,
        rarity: inv.item.rarity,
        assetKey: inv.item.assetKey,
        description: inv.item.description,
      })),
    });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── POST /api/profile/create — Character Creation ────────────────────────────
router.post('/create', requireAuth, [
  body('username').trim().isLength({ min: 2, max: 20 }).withMessage('Username must be 2–20 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, underscores'),
  avatarValidator,
  body('class').optional().isIn(['SCHOLAR', 'WARRIOR', 'GUARDIAN', 'ROGUE']),
  body('goals').optional().isArray(),
  body('country').optional().isString().isLength({ max: 2 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { username, avatar = 'warrior', class: characterClass = 'SCHOLAR', goals = ['STUDY', 'CODING'], country } = req.body;

  try {
    // Check username uniqueness
    const existing = await prisma.profile.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: 'Username already taken.' });

    // Check user doesn't already have a profile
    const existingProfile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (existingProfile) return res.status(409).json({ error: 'Character already created.' });

    // Class starting bonuses
    const classBonus = {
      SCHOLAR:  { intellect: 5, focus: 3 },
      WARRIOR:  { strength: 5, vitality: 3 },
      GUARDIAN: { discipline: 5, vitality: 3 },
      ROGUE:    { focus: 5, discipline: 3 },
    };
    const bonus = classBonus[characterClass] || {};

    // Create profile + attributes + settings in transaction
    await prisma.$transaction([
      prisma.profile.create({
        data: {
          userId: req.user.id,
          username,
          avatar,
          class: characterClass,
          title: 'Novice',
          country: country ? country.toUpperCase() : null,
          level: 1,
          totalXp: 0,
          currentXp: 0,
          gold: 100,
        },
      }),
      prisma.attribute.create({
        data: {
          userId: req.user.id,
          intellect: 10 + (bonus.intellect || 0),
          strength: 10 + (bonus.strength || 0),
          discipline: 10 + (bonus.discipline || 0),
          vitality: 10 + (bonus.vitality || 0),
          focus: 10 + (bonus.focus || 0),
          social: 10,
        },
      }),
      prisma.userSettings.create({
        data: {
          userId: req.user.id,
          goals: goals.join(','),
        },
      }),
    ]);

    res.status(201).json({ message: 'Character created successfully!', username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create character.' });
  }
});

// ─── PATCH /api/profile ────────────────────────────────────────────────────────
router.patch('/', requireAuth, [
  body('username').optional().trim().isLength({ min: 2, max: 20 }).withMessage('Username must be 2–20 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, underscores'),
  avatarValidator,
  body('title').optional().isString().isLength({ max: 50 }),
  body('goals').optional(),
  body('country').optional().isString().isLength({ max: 2 }).withMessage('Country must be a 2-letter code'),
  body('theme').optional().isString(),
  body('notificationsEnabled').optional().isBoolean(),
  body('activityTrackingEnabled').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { username, avatar, title, goals, country, theme, notificationsEnabled, activityTrackingEnabled } = req.body;

  try {
    const profileUpdates = {};
    if (avatar !== undefined) profileUpdates.avatar = avatar;
    if (title !== undefined) profileUpdates.title = title;
    if (country !== undefined) profileUpdates.country = country ? country.toUpperCase() : null;

    if (username !== undefined) {
      // Check if username is already taken by someone else
      const existing = await prisma.profile.findFirst({
        where: {
          username,
          userId: { not: req.user.id },
        },
      });
      if (existing) {
        return res.status(409).json({ error: 'Username is already taken by another adventurer.' });
      }
      profileUpdates.username = username;
    }

    let updatedProfile = null;
    if (Object.keys(profileUpdates).length > 0) {
      updatedProfile = await prisma.profile.update({
        where: { userId: req.user.id },
        data: profileUpdates,
      });
    } else {
      updatedProfile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    }

    // Handle settings updates
    const settingsUpdates = {};
    if (goals !== undefined) {
      const goalsStr = Array.isArray(goals) ? goals.join(',') : String(goals);
      settingsUpdates.goals = goalsStr;
    }
    if (theme !== undefined) settingsUpdates.theme = theme;
    if (notificationsEnabled !== undefined) settingsUpdates.notificationsEnabled = !!notificationsEnabled;
    if (activityTrackingEnabled !== undefined) settingsUpdates.activityTrackingEnabled = !!activityTrackingEnabled;

    let updatedSettings = null;
    if (Object.keys(settingsUpdates).length > 0) {
      updatedSettings = await prisma.userSettings.upsert({
        where: { userId: req.user.id },
        update: settingsUpdates,
        create: {
          userId: req.user.id,
          goals: settingsUpdates.goals || 'CODING,STUDY',
          theme: settingsUpdates.theme || 'dark',
          notificationsEnabled: settingsUpdates.notificationsEnabled ?? true,
          activityTrackingEnabled: settingsUpdates.activityTrackingEnabled ?? true,
        },
      });
    }

    const levelData = calculateLevel(updatedProfile.totalXp);
    res.json({
      ...updatedProfile,
      ...levelData,
      settings: updatedSettings,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router;
