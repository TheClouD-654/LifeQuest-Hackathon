// ============================================================
// Shop Routes — Server-authoritative purchasing
// GET  /api/shop
// POST /api/shop/:id/purchase
// ============================================================
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/shop
router.get('/', requireAuth, async (req, res) => {
  try {
    const [items, userInventory] = await Promise.all([
      prisma.shopItem.findMany({ orderBy: { price: 'asc' } }),
      prisma.inventory.findMany({
        where: { userId: req.user.id },
        select: { itemId: true, equipped: true },
      }),
    ]);

    const ownedMap = {};
    for (const inv of userInventory) {
      ownedMap[inv.itemId] = { owned: true, equipped: inv.equipped };
    }

    const itemsWithOwnership = items.map(item => ({
      ...item,
      owned: !!ownedMap[item.id],
      equipped: ownedMap[item.id]?.equipped || false,
    }));

    res.json(itemsWithOwnership);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

// POST /api/shop/:id/purchase — Server authoritative
router.post('/:id/purchase', requireAuth, async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Get item from DB (never trust client price)
      const item = await tx.shopItem.findUnique({ where: { id: req.params.id } });
      if (!item) throw { status: 404, message: 'Item not found' };

      // 2. Get user's actual gold from DB
      const profile = await tx.profile.findUnique({ where: { userId: req.user.id } });
      if (!profile) throw { status: 404, message: 'Profile not found' };

      // 3. Check if already owned
      const existing = await tx.inventory.findUnique({
        where: { userId_itemId: { userId: req.user.id, itemId: item.id } },
      });
      if (existing) throw { status: 409, message: 'You already own this item.' };

      // 4. Check sufficient gold
      if (profile.gold < item.price) {
        throw { status: 400, message: `Insufficient gold. You need ${item.price} gold but only have ${profile.gold}.` };
      }

      // 5. Deduct gold
      await tx.profile.update({
        where: { userId: req.user.id },
        data: { gold: profile.gold - item.price },
      });

      // 6. Add to inventory
      await tx.inventory.create({
        data: { userId: req.user.id, itemId: item.id },
      });

      return { item, newGold: profile.gold - item.price };
    }).then(result => {
      res.json({
        message: `${result.item.name} acquired!`,
        item: result.item,
        newGold: result.newGold,
      });
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Purchase failed. Your gold is safe.' });
  }
});

module.exports = router;
