// ============================================================
// LIFE RPG — Express Server Entry Point
// ============================================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const MySQLStore = require('express-mysql-session')(session);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable reverse proxy support for HTTPS on Render / cloud platforms
app.set('trust proxy', 1);

// ─── Database connection options for session store ────────────────────────────
let sessionStoreOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'life_rpg',
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000,
  createDatabaseTable: true,
};

if (process.env.DATABASE_URL) {
  try {
    const parsedUrl = new URL(process.env.DATABASE_URL);
    sessionStoreOptions.host = parsedUrl.hostname;
    sessionStoreOptions.port = parseInt(parsedUrl.port || '3306');
    sessionStoreOptions.user = decodeURIComponent(parsedUrl.username);
    sessionStoreOptions.password = decodeURIComponent(parsedUrl.password);
    sessionStoreOptions.database = parsedUrl.pathname.replace(/^\//, '').split('?')[0];
    if (parsedUrl.searchParams.has('ssl') || process.env.DATABASE_URL.includes('ssl') || process.env.NODE_ENV === 'production') {
      sessionStoreOptions.ssl = { rejectUnauthorized: false };
    }
  } catch (e) {
    console.warn('Could not parse DATABASE_URL for session store, using fallback config.');
  }
}

const sessionStore = new MySQLStore(sessionStoreOptions);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

app.use('/api', generalLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/login', authLimiter);

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  key: 'life_rpg_session',
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ─── Passport ─────────────────────────────────────────────────────────────────
require('./utils/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/attributes', require('./routes/attributes'));
app.use('/api/quests', require('./routes/quests'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/missions', require('./routes/missions'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/stats', require('./routes/stats'));

// ─── Static Frontend Serving (Unified Cloud Deployment) ──────────────────────
const path = require('path');
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler for API routes ───────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Fallback to index.html for root / unknown client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const statusCode = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred'
    : err.message;
  res.status(statusCode).json({ error: message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎮 Life RPG Backend running on port ${PORT} (bound to 0.0.0.0)`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
