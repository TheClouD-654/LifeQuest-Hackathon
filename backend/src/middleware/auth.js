// ============================================================
// Auth Middleware
// ============================================================

/**
 * Require authenticated session. Returns 401 if not authenticated.
 */
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required. Please log in.' });
};

/**
 * Require character/profile to be created. Returns 403 if not set up.
 */
const requireProfile = async (req, res, next) => {
  if (!req.user?.profile) {
    return res.status(403).json({ 
      error: 'Character not created yet.',
      code: 'NO_PROFILE'
    });
  }
  return next();
};

module.exports = { requireAuth, requireProfile };
