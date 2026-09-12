// ============================================================
// LIFE RPG — Express Server Entry Point
// ============================================================
require('dotenv').config();

// Ensure DATABASE_URL enforces TLS for TiDB Cloud / production if not already specified
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  if ((dbUrl.includes('tidbcloud.com') || process.env.NODE_ENV === 'production' || dbUrl.includes('ssl')) && !dbUrl.includes('sslaccept=')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    process.env.DATABASE_URL = `${dbUrl}${separator}sslaccept=strict`;
  }
}

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
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000,
  createDatabaseTable: true,
};

let dbPool = null;

if (process.env.DATABASE_URL) {
  try {
    const parsedUrl = new URL(process.env.DATABASE_URL);
    const poolConfig = {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port || '3306'),
      user: decodeURIComponent(parsedUrl.username),
      password: decodeURIComponent(parsedUrl.password),
      database: parsedUrl.pathname.replace(/^\//, '').split('?')[0],
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    };
    if (parsedUrl.searchParams.has('ssl') || process.env.DATABASE_URL.includes('ssl') || process.env.NODE_ENV === 'production') {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    const mysql = require('mysql2/promise');
    dbPool = mysql.createPool(poolConfig);
  } catch (e) {
    console.warn('Could not parse DATABASE_URL for session store pool, using fallback config.');
  }
} else {
  sessionStoreOptions.host = process.env.DB_HOST || 'localhost';
  sessionStoreOptions.port = parseInt(process.env.DB_PORT || '3306');
  sessionStoreOptions.user = process.env.DB_USER || 'root';
  sessionStoreOptions.password = process.env.DB_PASSWORD || '';
  sessionStoreOptions.database = process.env.DB_NAME || 'life_rpg';
}

const sessionStore = new MySQLStore(sessionStoreOptions, dbPool);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", "https://accounts.google.com"],
    },
  },
}));

app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  next();
});

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
  key: 'lifequest_session',
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
app.use('/api/leaderboard', require('./routes/leaderboard'));

// ─── Static Frontend Serving (Unified Cloud Deployment) ──────────────────────
const path = require('path');
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── SEO & OG Asset Endpoints with strict MIME types ─────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').sendFile(path.join(frontendPath, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').sendFile(path.join(frontendPath, 'sitemap.xml'));
});

app.get('/assets/og-image.png', (req, res) => {
  res.type('image/png').sendFile(path.join(frontendPath, 'assets/og-image.png'));
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
    console.log(`\n🎮 Life Quest Backend running on port ${PORT} (bound to 0.0.0.0)`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
