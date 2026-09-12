// ============================================================
// Passport.js Configuration
// Handles Google OAuth + Local (email/password) strategies
// ============================================================
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = (passport) => {
  // ─── Serialize / Deserialize ──────────────────────────────────────────────
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: { profile: true },
      });
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // ─── Local Strategy ───────────────────────────────────────────────────────
  passport.use(new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: { profile: true },
        });

        if (!user) {
          return done(null, false, { message: 'No account found with that email.' });
        }

        if (!user.passwordHash) {
          return done(null, false, { message: 'This account uses Google login. Please sign in with Google.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  // ─── Google OAuth Strategy ────────────────────────────────────────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const backendUrl = (process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${backendUrl}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          if (!profile || !profile.id) {
            return done(new Error('Invalid Google profile data received'));
          }

          // Check if user exists with this Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
            include: { profile: true },
          });

          if (user) {
            return done(null, user);
          }

          // Check if email already exists (link accounts)
          const email = profile.emails?.[0]?.value;
          if (email) {
            user = await prisma.user.findUnique({
              where: { email: email.toLowerCase() },
              include: { profile: true },
            });

            if (user) {
              // Link Google account to existing email account
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id },
                include: { profile: true },
              });
              return done(null, user);
            }
          }

          // New user via Google — create account (profile created separately in character creation)
          user = await prisma.user.create({
            data: {
              email: email?.toLowerCase() || `google_${profile.id}@placeholder.com`,
              googleId: profile.id,
            },
            include: { profile: true },
          });

          return done(null, user);
        } catch (err) {
          console.error('Google Strategy verification error:', err);
          return done(err);
        }
      }
    ));
  }
};
