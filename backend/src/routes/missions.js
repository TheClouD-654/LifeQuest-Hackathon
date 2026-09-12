// Missions Routes
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getTodaysMissions, generateDailyMissions } = require('../services/missionEngine');

// GET /api/missions/today
router.get('/today', requireAuth, async (req, res) => {
  try {
    const missions = await getTodaysMissions(req.user.id);
    res.json(missions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch missions' });
  }
});

// POST /api/missions/generate (force regenerate)
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const missions = await generateDailyMissions(req.user.id);
    res.json(missions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate missions' });
  }
});

module.exports = router;
