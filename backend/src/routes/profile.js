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

// ─── GET /api/profile ─────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found', code: 'NO_PROFILE' });

    const levelData = calculateLevel(profile.totalXp);
    res.json({ ...profile, ...levelData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── POST /api/profile/create — Character Creation ────────────────────────────
router.post('/create', requireAuth, [
  body('username').trim().isLength({ min: 2, max: 20 }).withMessage('Username must be 2–20 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, underscores'),
  body('avatar').optional().isString(),
  body('class').optional().isIn(['SCHOLAR', 'WARRIOR', 'GUARDIAN', 'ROGUE']),
  body('goals').optional().isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { username, avatar = 'warrior', class: characterClass = 'SCHOLAR', goals = ['STUDY', 'CODING'] } = req.body;

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
  body('avatar').optional().isString(),
  body('title').optional().isString().isLength({ max: 50 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const allowed = ['avatar', 'title'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  try {
    const profile = await prisma.profile.update({
      where: { userId: req.user.id },
      data: updates,
    });
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router;
