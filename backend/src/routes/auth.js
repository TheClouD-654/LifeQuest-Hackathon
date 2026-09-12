// ============================================================
// Auth Routes
// POST /api/auth/signup
// POST /api/auth/login
// POST /api/auth/logout
// GET  /api/auth/me
// GET  /api/auth/google
// GET  /api/auth/google/callback
// ============================================================
const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// ─── Validation rules ─────────────────────────────────────────────────────────
const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
router.post('/signup', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
      },
      include: { profile: true },
    });

    // Auto-login after signup
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login after signup failed' });
      return res.status(201).json({
        message: 'Account created successfully',
        user: { id: user.id, email: user.email },
        needsProfile: !user.profile,
      });
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: 'Authentication error' });
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Session creation failed' });
      return res.json({
        message: 'Login successful',
        user: { id: user.id, email: user.email },
        needsProfile: !user.profile,
      });
    });
  })(req, res, next);
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy(() => {
      res.clearCookie('life_rpg_session');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        attributes: true,
        settings: true,
      },
    });
    res.json({
      id: user.id,
      email: user.email,
      hasGoogleAuth: !!user.googleId,
      profile: user.profile,
      attributes: user.attributes,
      settings: user.settings,
      needsProfile: !user.profile,
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// ─── GET /api/auth/google ─────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ─── GET /api/auth/google/callback ───────────────────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/pages/auth.html?error=google_failed` }),
  (req, res) => {
    const needsProfile = !req.user.profile;
    if (needsProfile) {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/character.html`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/dashboard.html`);
    }
  }
);

module.exports = router;
