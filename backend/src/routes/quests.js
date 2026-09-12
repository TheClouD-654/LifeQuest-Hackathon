// ============================================================
// Quest Routes — Full CRUD + server-authoritative completion
// GET    /api/quests
// POST   /api/quests
// GET    /api/quests/:id
// PATCH  /api/quests/:id
// DELETE /api/quests/:id
// POST   /api/quests/:id/complete
// ============================================================
const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');
const { calculateQuestXp, calculateQuestGold, completeQuest } = require('../services/rpgEngine');
const { checkAndUnlockAchievements } = require('../services/achievementService');

const questValidation = [
  body('title').trim().notEmpty().isLength({ max: 100 }).withMessage('Title required (max 100 chars)'),
  body('description').trim().isLength({ max: 500 }).withMessage('Description max 500 chars'),
  body('category').optional().isString(),
  body('difficulty').optional().isIn(['EASY', 'MEDIUM', 'HARD', 'EPIC']),
  body('type').optional().isIn(['ACTIVITY', 'PRODUCTIVITY', 'HEALTH', 'HABIT', 'CUSTOM']),
  body('dueDate').optional().isISO8601(),
];

// ─── GET /api/quests ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, type, date } = req.query;
    const where = { userId: req.user.id, status: { not: 'DELETED' } };
    if (status) where.status = status;
    if (type) where.type = type;
    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      where.createdAt = { gte: start, lt: end };
    }

    const quests = await prisma.quest.findMany({
      where,
      include: {
        attributeRewards: true,
        completions: { where: { userId: req.user.id } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// ─── POST /api/quests ─────────────────────────────────────────────────────────
router.post('/', requireAuth, questValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { title, description = '', category = 'OTHER', difficulty = 'MEDIUM', type = 'CUSTOM', dueDate, attributeRewards = [] } = req.body;

  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    const level = profile?.level || 1;

    // Server calculates rewards — client cannot set these
    const xpReward = calculateQuestXp(difficulty, level);
    const goldReward = calculateQuestGold(difficulty, level);

    const quest = await prisma.quest.create({
      data: {
        userId: req.user.id,
        title,
        description,
        type,
        category: category.toUpperCase(),
        difficulty,
        xpReward,
        goldReward,
        status: 'ACTIVE',
        source: 'manual',
        dueDate: dueDate ? new Date(dueDate) : null,
        attributeRewards: {
          create: attributeRewards
            .filter(ar => ar.attribute && ar.value > 0)
            .slice(0, 6) // Max 6 attribute rewards
            .map(ar => ({ attribute: ar.attribute.toLowerCase(), value: Math.min(ar.value, 20) })),
        },
      },
      include: { attributeRewards: true },
    });

    res.status(201).json(quest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create quest' });
  }
});

// ─── GET /api/quests/:id ──────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const quest = await prisma.quest.findUnique({
      where: { id: req.params.id },
      include: { attributeRewards: true, completions: { where: { userId: req.user.id } } },
    });
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    if (quest.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    res.json(quest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quest' });
  }
});

// ─── PATCH /api/quests/:id ────────────────────────────────────────────────────
router.patch('/:id', requireAuth, [
  body('title').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('difficulty').optional().isIn(['EASY', 'MEDIUM', 'HARD', 'EPIC']),
  body('dueDate').optional().isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const quest = await prisma.quest.findUnique({ where: { id: req.params.id } });
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    if (quest.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (quest.status === 'COMPLETED') return res.status(400).json({ error: 'Cannot edit completed quest' });

    const allowed = ['title', 'description', 'category', 'dueDate'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // If difficulty changes, recalculate rewards server-side
    if (req.body.difficulty) {
      const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
      updates.difficulty = req.body.difficulty;
      updates.xpReward = calculateQuestXp(req.body.difficulty, profile?.level || 1);
      updates.goldReward = calculateQuestGold(req.body.difficulty, profile?.level || 1);
    }

    const updated = await prisma.quest.update({
      where: { id: req.params.id },
      data: updates,
      include: { attributeRewards: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update quest' });
  }
});

// ─── DELETE /api/quests/:id ───────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const quest = await prisma.quest.findUnique({ where: { id: req.params.id } });
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    if (quest.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    // Soft delete
    await prisma.quest.update({
      where: { id: req.params.id },
      data: { status: 'DELETED' },
    });
    res.json({ message: 'Quest deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete quest' });
  }
});

// ─── POST /api/quests/:id/complete — Server-Authoritative ────────────────────
router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const result = await completeQuest(req.user.id, req.params.id);

    // Check achievements after completion
    const newAchievements = await checkAndUnlockAchievements(req.user.id);
    result.newAchievements = newAchievements;

    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Quest completion error:', err);
    res.status(500).json({ error: 'Quest completion failed. Your progress is safe.' });
  }
});

module.exports = router;
