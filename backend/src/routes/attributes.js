// Attributes Routes — GET /api/attributes
const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const attributes = await prisma.attribute.findUnique({ where: { userId: req.user.id } });
    if (!attributes) return res.status(404).json({ error: 'Attributes not found' });
    res.json(attributes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attributes' });
  }
});

module.exports = router;
