# ========================================
# LIFE QUEST — Root README
# ========================================

# ⚔ Life Quest — Turn Your Life Into an Adventure

> A full-stack "Life Quest" web application where real-world daily activities are converted into RPG-style quests, character progression, attributes, streaks, currency, rewards, and character growth.

## 🎮 Core Features

- **Adaptive Daily Quests** — Server-generated missions based on your activity patterns
- **Character Progression** — Level 1–99+, 6 attributes (Intellect, Strength, Discipline, Vitality, Focus, Social)
- **Streaks & Momentum** — Daily streak tracking with compounding rewards
- **Gold Economy** — Earn from quests, spend in the Armory on cosmetics & titles
- **Achievements System** — 15+ unlockable achievements for milestones
- **Activity Logging** — Track coding, study, fitness, reading, entertainment, social, work
- **Server-Authoritative** — All XP, Gold, and levels are tamper-proof (never trust the client)

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (Vanilla), Vanilla JS |
| Backend | Node.js + Express.js |
| Database | MySQL + Prisma ORM |
| Auth | Passport.js (Local + Google OAuth) |
| Sessions | express-session + express-mysql-session |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8+ (running locally or remote)
- npm

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

### 3. Initialize Database

```bash
# Push schema to MySQL
npm run db:push

# Seed shop items, achievements, and demo user
npm run db:seed
```

### 4. Start Backend

```bash
npm run dev
```

### 5. Serve Frontend

Open `frontend/index.html` in a browser, or use a simple server:

```bash
npx serve frontend -p 3000
```

### 6. Demo Account

After seeding, you can log in with:
- **Email:** demo@liferpg.dev
- **Password:** demo1234

## 📁 Project Structure

```
LifeQuest/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # 13-table database schema
│   │   └── seed.js             # Shop items, achievements, demo user
│   └── src/
│       ├── server.js           # Express server + middleware
│       ├── routes/             # REST API routes
│       │   ├── auth.js         # Signup, login, Google OAuth
│       │   ├── profile.js      # Character profile
│       │   ├── attributes.js   # RPG attributes
│       │   ├── quests.js       # Quest CRUD + completion
│       │   ├── missions.js     # Daily mission generation
│       │   ├── activity.js     # Activity logging
│       │   ├── shop.js         # Server-authoritative shop
│       │   ├── inventory.js    # Inventory management
│       │   ├── achievements.js # Achievement listing
│       │   └── stats.js        # Comprehensive stats
│       ├── services/
│       │   ├── rpgEngine.js    # Level formula, quest completion
│       │   ├── missionEngine.js# Adaptive quest generation
│       │   └── achievementService.js
│       ├── middleware/
│       │   └── auth.js         # requireAuth, requireProfile
│       └── utils/
│           └── passport.js     # Local + Google OAuth strategies
└── frontend/
    ├── index.html              # Landing page
    ├── css/
    │   ├── globals.css         # Design system + tokens
    │   ├── components.css      # Quest cards, character panel
    │   └── animations.css      # Level-up, XP popups, particles
    ├── js/
    │   ├── api/api.js          # Centralized API client
    │   ├── utils/helpers.js    # Formatters, builders, toast
    │   └── animations/         # Quest completion sequences
    └── pages/
        ├── auth.html           # Login / Signup
        ├── character.html      # Character creation
        ├── dashboard.html      # Main status screen
        ├── quests.html         # Quest board
        ├── activity.html       # Activity logging
        ├── shop.html           # Armory
        ├── inventory.html      # Owned items
        ├── stats.html          # Stats & Achievements
        └── settings.html       # Account settings
```

## 🔒 Security Architecture

- **Server-Authoritative**: XP, Gold, Level are ALWAYS calculated server-side
- **Prisma Transactions**: Quest completion uses `prisma.$transaction` for atomicity
- **Session-Based Auth**: HTTP-only cookies, never JWT in localStorage
- **Rate Limiting**: Auth routes limited to 20 req/15min, general API to 200 req/15min
- **Input Validation**: express-validator on all endpoints

## 📊 RPG System

### Level Formula
```js
XP_REQUIRED(level) = Math.floor(100 * Math.pow(level, 1.5))
// Level 1: 100 XP, Level 10: 316 XP, Level 20: 894 XP, Level 50: 3535 XP
```

### Difficulty Rewards
| Difficulty | XP | Gold |
|------------|-----|------|
| Easy | 40–70 | 20–40 |
| Medium | 70–120 | 40–70 |
| Hard | 120–200 | 70–100 |
| Epic | 200–350 | 100–200 |

### Attribute Sources
| Activity | Attribute Gains |
|---------|----------------|
| Coding | +Intellect, +Focus |
| Study | +Intellect, +Discipline |
| Fitness | +Strength, +Vitality |
| Reading | +Intellect, +Focus |
| Social | +Social |
| Work | +Focus, +Discipline |

---

*Life Quest — Turn Your Life Into an Adventure*
