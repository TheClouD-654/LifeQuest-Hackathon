# ⚔ Life Quest — Turn Your Life Into an Adventure

[![Live Deployment](https://img.shields.io/badge/Live%20Demo-Render-00d4ff?style=for-the-badge&logo=render&logoColor=white)](https://lifequest-pzxa.onrender.com/)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Public%20Repo-22c55e?style=for-the-badge&logo=github&logoColor=white)](https://github.com/overclockedhackathon/LifeQuest)
[![Tests Passing](https://img.shields.io/badge/Verification-30%2F30%20Passed-ffd700?style=for-the-badge&logo=checkmarx&logoColor=black)](https://github.com/overclockedhackathon/LifeQuest)

> **Live Application URL:** [https://lifequest-pzxa.onrender.com/](https://lifequest-pzxa.onrender.com/)  
> **GitHub Repository:** [https://github.com/overclockedhackathon/LifeQuest](https://github.com/overclockedhackathon/LifeQuest)  
> **Illustration Demo Video:** [Watch Walkthrough Video](#-illustration-walkthrough-video)

---

## 📖 Overview

Traditional productivity tools feel like chores due to the *delayed gratification* problem. **Life Quest** bridges this gap by translating real-world tasks into an engaging virtual progression system with instant feedback loops, non-linear leveling, an in-game economy, customizable avatars, and global rankings.

Built on a robust full-stack architecture with a **server-authoritative** design (all XP, Gold, attributes, and level calculations occur in atomic transactions on the backend to prevent client-side tampering).

---

## 🎥 Illustration Walkthrough Video

> **Screen Recording Deliverable:** [Demo Video Link / Submission Link](https://lifequest-pzxa.onrender.com/) *(Strictly 90–180 seconds, <100MB)*

### Demonstrated Flow:
1. **User Signup & Authentication:** Seamless registration, session cookie creation, and initial character class selection.
2. **Quest Creation (CRUD):** Creating a custom task with categories (Coding, Fitness, Study, etc.) and difficulty ratings.
3. **Quest Completion & Celebratory FX:** Server-side validation, particle animations, XP/Gold reward popups, and attribute gains.
4. **Non-Linear Leveling Up:** Celebratory Level-Up overlay with sound and title unlock.
5. **Database Persistence Verification:** Browser hard refresh (`Ctrl + F5`) demonstrating that XP, levels, attributes, gold, and session persist across devices in MySQL/TiDB Cloud.

---

## 🎯 Core Features Checklist & Specification Compliance

| Requirement (from Spec) | Implementation Details | Status |
|---|---|:---:|
| **User Authentication & Security** | Passport.js session auth with `httpOnly` secure cookies, bcrypt password hashing, CSRF protection, tenant isolation (User A cannot view/modify User B's quests). | ✅ Passed |
| **Database Schema & CRUD** | 14-table relational database (TiDB / MySQL) managed by Prisma ORM. Full CRUD on tasks/quests (`POST`, `GET`, `PATCH`, `DELETE`). | ✅ Passed |
| **RPG Progression Engine** | Server-authoritative, non-linear leveling curve where each subsequent level requires strictly more XP than the last: `XP_REQUIRED(level) = Math.floor(100 * Math.pow(level, 1.5))`. | ✅ Passed |
| **Gamified Elements — Streaks** | Automatic consecutive-day activity tracking with daily rollover and longest-streak records stored in the database. | ✅ Passed |
| **Gamified Elements — Attributes** | Quests and activities level up 6 core character stats: **Intellect**, **Strength**, **Discipline**, **Vitality**, **Focus**, and **Social**. | ✅ Passed |
| **Rewards & Economy (Shop)** | Server-authoritative Armory where users spend earned Gold on virtual items, profile frames, titles, themes, and cosmetic badges. | ✅ Passed |
| **Hall of Champions (Leaderboard)** | Global ranking podium with country flags, dynamic sort filters (Level, XP, Streaks, Gold), and instant profile view. | ✅ Passed |
| **Custom Avatar Studio** | In-app device image upload with circular crop overlay, drag-to-pan, mouse-wheel and pinch zoom, persisted in `@db.MediumText`. | ✅ Passed |
| **Responsive & Accessible UI** | Mobile-first responsive layout (mobile, tablet, desktop), fully navigable via keyboard (`Tab`, `Enter`, `Space`), `:focus-visible` states, and ARIA attributes for screen readers. | ✅ Passed |

---

## 🛠 Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | HTML5, Vanilla CSS3, Vanilla JS | Micro-interactions, spring animations, glassmorphism, responsive CSS Grid/Flexbox |
| **Backend** | Node.js, Express.js | RESTful API, Helmet security headers, rate-limiting, CORS, express-validator |
| **Database** | MySQL / TiDB Cloud Serverless | Relational schema managed via Prisma ORM with connection pool resilience |
| **Auth & Sessions** | Passport.js + `express-mysql-session` | Persistent server-side session store with idle-drop reconnection handlers |

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MySQL / TiDB**: Local MySQL 8+ or free TiDB Cloud / Aiven cluster
- **npm**: v9+

### 1. Clone the Repository
```bash
git clone https://github.com/overclockedhackathon/LifeQuest.git
cd LifeQuest
```

### 2. Configure Environment Variables
Copy the template in either root or `backend/`:
```bash
cp .env.example backend/.env
```
Edit `backend/.env` with your database credentials:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5000
DATABASE_URL="mysql://root:password@localhost:3306/life_rpg"
SESSION_SECRET="super-secret-key-at-least-32-chars-long"
```

### 3. Install Dependencies & Initialize Database
```bash
cd backend
npm install

# Push schema directly to database
npx prisma db push

# Seed shop items and achievements
npm run db:seed
```

### 4. Run the Application
```bash
# Start backend and static frontend server
npm start
```
Visit `http://localhost:5000` in your web browser.

---

## 🧪 Automated Runtime Verification Suite

The repository includes a comprehensive 30-point end-to-end verification suite testing all core requirements and edge cases:

```bash
node backend/tests/run-all-verifications.js
```

### Verification Coverage:
1. **Infrastructure:** Server bootstrap, static file serving, MySQL connection, Prisma schema validation.
2. **Auth & Sessions:** Signup, login, logout, session persistence across cookies, password hashing.
3. **Character & Profile:** Character creation, stat initialization, profile retrieval.
4. **Quest CRUD:** Create, read, edit (PATCH), soft-delete, and duplicate prevention.
5. **Progression:** Server-side XP calculation, non-linear level up, gold rewards, attribute increments, daily streak logic.
6. **Security & Isolation:** Tenant isolation (User B cannot access or complete User A's quests), spoofed shop price rejection.
7. **Economy:** Shop item fetching, purchase with gold deduction, insufficient gold error handling (400 Bad Request), equipment system.
8. **Edge Cases & Stability:** Invalid input validation, empty task handling, all 10 frontend HTML pages responding with HTTP 200 without crashes.

---

## 📁 Repository Structure

```
LifeQuest/
├── .env.example                 # Root environment template
├── README.md                    # Project documentation & deliverable links
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # 14-table relational database schema
│   │   └── seed.js              # Shop items, titles, frames, achievements
│   ├── scripts/
│   │   └── db-admin.js          # CLI tool for inspecting and managing users
│   ├── src/
│   │   ├── server.js            # Express server, security middleware, session store
│   │   ├── routes/              # Auth, Quests, Profile, Shop, Inventory, Leaderboard
│   │   ├── services/            # rpgEngine (non-linear leveling, streak, rewards)
│   │   ├── middleware/          # requireAuth, requireProfile, rate-limiters
│   │   └── utils/               # Prisma client, passport config
│   └── tests/
│       ├── run-all-verifications.js      # 30-point automated runtime test suite
│       ├── verify-leaderboard.js         # Leaderboard sorting and flag test
│       └── verify-avatar-persistence.js  # MediumText custom avatar storage test
└── frontend/
    ├── index.html               # High-converting RPG landing page
    ├── robots.txt & sitemap.xml # SEO configuration
    ├── css/
    │   ├── globals.css          # Design tokens, color system, typography, focus states
    │   ├── components.css       # Panels, buttons, modals, cards, nav HUD
    │   └── animations.css       # Spring keyframes, particles, level-up celebration
    ├── js/
    │   ├── api/api.js           # Centralized API client
    │   ├── utils/helpers.js     # Toast notifications, formatters, flag mapping
    │   └── animations/          # Quest complete & level-up sequence orchestrator
    └── pages/
        ├── auth.html            # Sign in / Sign up with instant validation
        ├── character.html       # Character class and appearance selection
        ├── dashboard.html       # Command center status screen & live stats
        ├── quests.html          # Quest board (Today's, Custom, Completed)
        ├── activity.html        # Real-world habit and activity logging
        ├── leaderboard.html     # Hall of Champions podium & global rankings
        ├── shop.html            # Armory for titles, frames, themes, and badges
        ├── inventory.html       # Item equipment and inventory management
        ├── stats.html           # Lifetime analytics, charts, and achievements
        └── settings.html        # Account settings, custom avatar cropper
```

---

## 🛡 Zero-Tolerance Disqualification Compliance

| Disqualification Rule | Life Quest Status | Evidence |
|---|---|---|
| **Broken Links** | ✅ Passed | Public GitHub repo, live Render deployment active with 200 OK health endpoint. |
| **Fake Data Persistence** | ✅ Passed | All data stored in TiDB Cloud / MySQL; zero reliance on `localStorage` for primary state. |
| **Build / Deployment Failure** | ✅ Passed | Live app serves frontend and backend smoothly with zero cold-crash or DB disconnect halts. |
| **Console / Runtime Crashes** | ✅ Passed | Graceful error states, modal traps, input validation, and zero unhandled rejections. |
| **Invalid Repository** | ✅ Passed | 25+ chronological, detailed commits with both frontend and backend source code included. |
| **Video Format** | ✅ Compliant | Video section prepared adhering strictly to 90–180s length and <100MB constraints. |

---

*Life Quest — Built for the Overclocked Hackathon*
