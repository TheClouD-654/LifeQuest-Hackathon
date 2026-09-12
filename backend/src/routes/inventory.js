// Inventory Routes
const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

// GET /api/inventory
router.get('/', requireAuth, async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      where: { userId: req.user.id },
      include: { item: true },
      orderBy: { purchasedAt: 'desc' },
    });
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// POST /api/inventory/:id/equip
router.post('/:id/equip', requireAuth, async (req, res) => {
  try {
    const inv = await prisma.inventory.findUnique({
      where: { id: req.params.id },
      include: { item: true },
    });
    if (!inv) return res.status(404).json({ error: 'Item not found in inventory' });
    if (inv.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    // Unequip other items of same type
    await prisma.inventory.updateMany({
      where: {
        userId: req.user.id,
        item: { type: inv.item.type },
        equipped: true,
      },
      data: { equipped: false },
    });

    const updated = await prisma.inventory.update({
      where: { id: req.params.id },
      data: { equipped: true },
      include: { item: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to equip item' });
  }
});

// POST /api/inventory/:id/unequip
router.post('/:id/unequip', requireAuth, async (req, res) => {
  try {
    const inv = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!inv) return res.status(404).json({ error: 'Item not found' });
    if (inv.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const updated = await prisma.inventory.update({
      where: { id: req.params.id },
      data: { equipped: false },
      include: { item: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to unequip item' });
  }
});

module.exports = router;
