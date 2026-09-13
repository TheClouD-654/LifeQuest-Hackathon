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
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

// ─── Validation rules ─────────────────────────────────────────────────────────
const signupValidation = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
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
router.post('/logout', (req, res) => {
  const finalizeLogout = () => {
    res.clearCookie('lifequest_session');
    res.clearCookie('life_rpg_session');
    return res.json({ message: 'Logged out successfully' });
  };

  if (typeof req.logout === 'function') {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      if (req.session) {
        req.session.destroy(() => finalizeLogout());
      } else {
        finalizeLogout();
      }
    });
  } else if (req.session) {
    req.session.destroy(() => finalizeLogout());
  } else {
    finalizeLogout();
  }
});

// ─── DELETE /api/auth/account ─────────────────────────────────────────────────
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user to verify credentials
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user has a passwordHash, verify password
    if (user.passwordHash) {
      const { password } = req.body || {};
      if (!password) {
        return res.status(400).json({ error: 'Password is required to confirm account deletion' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password. Account deletion aborted.' });
      }
    } else {
      // For Google OAuth users (no passwordHash set)
      const { confirmation } = req.body || {};
      if (confirmation !== 'DELETE') {
        return res.status(400).json({ error: 'Please type DELETE to confirm account deletion' });
      }
    }

    // Permanently delete user from database (cascades profile, quests, inventory, etc.)
    await prisma.user.delete({
      where: { id: userId },
    });

    const finalizeDelete = () => {
      res.clearCookie('lifequest_session');
      res.clearCookie('life_rpg_session');
      return res.json({ message: 'Account deleted permanently' });
    };

    if (typeof req.logout === 'function') {
      req.logout(() => {
        if (req.session) {
          req.session.destroy(() => finalizeDelete());
        } else {
          finalizeDelete();
        }
      });
    } else if (req.session) {
      req.session.destroy(() => finalizeDelete());
    } else {
      finalizeDelete();
    }
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
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
      createdAt: user.createdAt,
      hasGoogleAuth: !!user.googleId,
      profile: user.profile,
      character: user.profile ? {
        name: user.profile.username,
        level: user.profile.level,
        class: user.profile.class,
        gold: user.profile.gold,
        avatar: user.profile.avatar,
        title: user.profile.title,
      } : null,
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
router.get('/google', (req, res, next) => {
  const redirectBase = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${redirectBase}/pages/auth.html?error=google_not_configured`);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// ─── GET /api/auth/google/callback ───────────────────────────────────────────
router.get('/google/callback', (req, res, next) => {
  const redirectBase = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${redirectBase}/pages/auth.html?error=google_not_configured`);
  }

  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google OAuth callback authentication error:', err);
      return res.redirect(`${redirectBase}/pages/auth.html?error=google_failed`);
    }

    if (!user) {
      console.warn('Google OAuth authentication failed (no user):', info);
      return res.redirect(`${redirectBase}/pages/auth.html?error=google_failed`);
    }

    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('Google OAuth session login error:', loginErr);
        return res.redirect(`${redirectBase}/pages/auth.html?error=google_failed`);
      }

      // Explicitly persist session to store before redirecting to avoid race condition with MySQL session store
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error after Google OAuth login:', saveErr);
        }

        const needsProfile = !(user && user.profile);
        if (needsProfile) {
          return res.redirect(`${redirectBase}/pages/character.html`);
        }
        return res.redirect(`${redirectBase}/pages/dashboard.html`);
      });
    });
  })(req, res, next);
});

module.exports = router;
