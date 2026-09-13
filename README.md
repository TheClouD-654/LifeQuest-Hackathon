# ⚔️ LifeQuest — Turn Your Life Into an Adventure

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Play%20Now-00d4ff?style=for-the-badge&logo=render&logoColor=white)](https://lifequest-pzxa.onrender.com/)
[![GitHub Release](https://img.shields.io/badge/Release-v1.0.0-22c55e?style=for-the-badge&logo=github&logoColor=white)](https://github.com/TheClouD-654/LifeQuest-Hackathon/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

> **🎮 Live Application:** [https://lifequest-pzxa.onrender.com](https://lifequest-pzxa.onrender.com)  
> **📦 Repository:** [https://github.com/TheClouD-654/LifeQuest-Hackathon](https://github.com/TheClouD-654/LifeQuest-Hackathon)  
> **🎥 Video Walkthrough:** [Watch Demo on YouTube](https://youtu.be/ykyJNNiLiTM)  
> **👤 Creator:** [@TheClouD-654](https://github.com/TheClouD-654)

---

## 🌟 Overview

Most productivity tools and habit trackers feel like mundane chores. They struggle with the **delayed gratification** problem: working out, reading, or coding takes weeks or months to show visible payoff in real life.

**LifeQuest** bridges that gap by turning your daily routines into a full-fledged **Role-Playing Game (RPG)**:
- **Complete real-world tasks** ➔ Earn instant XP, Gold, and attribute stats.
- **Micro-interactions & Audio FX** ➔ Particle bursts and celebratory sound effects when completing quests.
- **Server-authoritative Leveling** ➔ Non-linear leveling curve that makes long-term progression genuinely rewarding.
- **Armory & Economy** ➔ Spend earned gold on custom titles, animated profile frames, and retro color themes.
- **Hall of Champions** ➔ Compete against others on a real-time global leaderboard.

---

## 🎥 Walkthrough Video

Watch the full gameplay loop and feature walkthrough:

[![LifeQuest Walkthrough](https://img.shields.io/badge/YouTube-Watch%20Walkthrough%20Video-red?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/ykyJNNiLiTM)

> **Local Demo File:** [`demo/LifeQuest.mp4`](demo/LifeQuest.mp4) (Full 2-minute walkthrough covering user onboarding, quest creation, celebratory particle FX, non-linear leveling, and real-time database persistence).

---

## ⚡ Core Features

### 🗡️ Quest Board & Habit Tracker
- **Categories:** Organize quests by real-world areas: *Coding, Fitness, Academics, Mindfulness, Social, and Chores*.
- **Difficulty Scaling:** Choose between *Easy, Medium, Hard, and Epic* quests with scalable XP and Gold rewards.
- **Tactile Feedback:** Satisfying spring animations, sound cues, and celebratory particle effects on completion.

### 📈 Non-Linear RPG Progression
- Server-authoritative leveling system where each level requires progressively more effort:
  $$\text{XP Required} = \lfloor 100 \times \text{Level}^{1.5} \rfloor$$
- Prevents client-side tampering and ensures progression feels earned.

### 🧬 6 Real-World Attributes
Every quest directly levels up one of your core character stats:
- 🧠 **Intellect** — Coding, reading, technical skills
- ⚔️ **Strength** — Gym, workouts, physical training
- 🛡️ **Discipline** — Daily routines, habits, waking up on schedule
- 💖 **Vitality** — Nutrition, hydration, sleep quality
- 🎯 **Focus** — Deep work, distraction-free study blocks
- 🤝 **Social** — Networking, friendships, community events

### 🔥 Streaks & Momentum
- Automatically tracks consecutive days of activity.
- Keeps you accountable to daily momentum with streak bonuses.

### 🛒 Armory & In-Game Economy
- Earn Gold through real-life tasks and visit the Armory.
- Unlock cosmetic titles (*"Code Wizard"*, *"Iron Lifter"*, *"Night Owl"*), animated profile borders, and retro UI themes.

### 🏆 Hall of Champions
- Global real-time ranking podium with country flags.
- Filter rankings by Level, Total XP, Longest Streaks, or Gold amassed.

### 🎨 Custom Avatar Studio
- Built-in photo cropper with circular preview, drag-to-pan, and mouse-wheel zoom.
- Cloud-persisted so your character looks unique across every device.

---

## 🛠️ Tech Stack

| Layer | Technology | Highlights |
|---|---|---|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES6+) | Custom glassmorphism design system, CSS micro-interactions, responsive mobile-first UI, zero bloated frameworks |
| **Backend** | Node.js, Express.js | REST API, Helmet security headers, rate limiting, input validation |
| **Database** | MySQL / TiDB Cloud Serverless | 14-table relational database managed via Prisma ORM |
| **Authentication** | Passport.js + `express-mysql-session` | Persistent session cookies, bcrypt password hashing, CSRF protection |

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [MySQL](https://dev.mysql.com/) 8+ or a cloud database ([TiDB Cloud Serverless](https://tidbcloud.com/), [Aiven](https://aiven.io/), etc.)
- npm (v9+)

### 1. Clone the Repository
```bash
git clone https://github.com/TheClouD-654/LifeQuest-Hackathon.git
cd LifeQuest-Hackathon
```

### 2. Set Up Environment Variables
Copy the `.env.example` template:
```bash
cp .env.example backend/.env
```
Update `backend/.env` with your database credentials:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5000
DATABASE_URL="mysql://root:yourpassword@localhost:3306/life_rpg"
SESSION_SECRET="your-super-secret-key-at-least-32-chars-long"
```

### 3. Install & Seed Database
```bash
cd backend
npm install

# Push database schema
npx prisma db push

# Seed initial shop items and achievements
npm run db:seed
```

### 4. Start the Application
```bash
npm start
```
Visit [http://localhost:5000](http://localhost:5000) in your browser.

---

## 👤 Author

**Arunangshu (TheClouD-654)**
- GitHub: [@TheClouD-654](https://github.com/TheClouD-654)
- Live Web App: [https://lifequest-pzxa.onrender.com](https://lifequest-pzxa.onrender.com)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
