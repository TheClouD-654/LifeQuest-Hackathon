#!/usr/bin/env node
// ============================================================
// db-admin.js — Local admin CLI for LifeQuest data
//
// Run from backend/ (needs .env with DATABASE_URL):
//   node scripts/db-admin.js list                    → all profiles
//   node scripts/db-admin.js find <text>             → search username/email
//   node scripts/db-admin.js stats                   → row counts per table
//   node scripts/db-admin.js delete <username> [--yes] → delete user (dry-run without --yes)
//   node scripts/db-admin.js rename <old> <new>      → rename a profile's username
// ============================================================
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const command = args[0];

const fmt = (n) => (n ?? 0).toLocaleString();

async function list() {
  const profiles = await prisma.profile.findMany({
    orderBy: [{ level: 'desc' }, { totalXp: 'desc' }],
    include: { user: { select: { email: true, createdAt: true } } },
  });
  if (profiles.length === 0) return console.log('No profiles found.');
  console.log(`\n${profiles.length} profile(s):\n`);
  for (const p of profiles) {
    console.log(
      `#${p.username.padEnd(16)} LV${String(p.level).padEnd(4)} ` +
      `${fmt(p.totalXp)} XP  ${fmt(p.gold)} gold  streak ${p.currentStreak}  ` +
      `${p.country || '--'}  ${p.user.email}  joined ${p.user.createdAt.toISOString().slice(0, 10)}`
    );
  }
}

async function find(term) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: term } },
        { profile: { username: { contains: term } } },
      ],
    },
    include: { profile: true },
  });
  if (users.length === 0) return console.log(`No matches for "${term}".`);
  console.log(`\n${users.length} match(es):\n`);
  for (const u of users) {
    console.log(`email: ${u.email}`);
    console.log(`  id:  ${u.id}`);
    console.log(`  profile: ${u.profile ? `${u.profile.username} LV${u.profile.level}` : '(none)'}\n`);
  }
}

async function stats() {
  const tables = ['user', 'profile', 'quest', 'questCompletion', 'activityLog', 'shopItem', 'inventory', 'achievement', 'userAchievement'];
  console.log('\nRow counts:');
  for (const t of tables) {
    console.log(`  ${t.padEnd(18)} ${fmt(await prisma[t].count())}`);
  }
}

async function destroy(username, confirmed) {
  const profile = await prisma.profile.findUnique({ where: { username } });
  if (!profile) return console.log(`No profile named "${username}". Try: node scripts/db-admin.js list`);
  if (!confirmed) {
    return console.log(
      `\nDRY RUN — would DELETE user behind "${username}" (LV${profile.level}, ${fmt(profile.totalXp)} XP).\n` +
      `All their quests, completions, logs, inventory, and achievements cascade too.\n` +
      `Run again with --yes to execute.\n`
    );
  }
  const res = await prisma.user.deleteMany({ where: { profile: { username } } });
  console.log(res.count ? `✅ Deleted "${username}".` : 'Nothing deleted.');
}

async function rename(oldName, newName) {
  if (!oldName || !newName) return console.log('Usage: node scripts/db-admin.js rename <oldUsername> <newUsername>');
  const exists = await prisma.profile.findUnique({ where: { username: newName } });
  if (exists) return console.log(`"${newName}" is already taken.`);
  const updated = await prisma.profile.update({ where: { username: oldName }, data: { username: newName } }).catch(() => null);
  console.log(updated ? `✅ Renamed "${oldName}" → "${newName}".` : `No profile named "${oldName}".`);
}

async function main() {
  switch (command) {
    case 'list': return list();
    case 'find': return find(args[1] || '');
    case 'stats': return stats();
    case 'delete': return destroy(args[1], args.includes('--yes'));
    case 'rename': return rename(args[1], args[2]);
    default:
      console.log(`LifeQuest DB Admin

  node scripts/db-admin.js list                      all profiles, newest stats
  node scripts/db-admin.js find <text>               search by username or email
  node scripts/db-admin.js stats                     row counts per table
  node scripts/db-admin.js delete <username>         dry-run a delete
  node scripts/db-admin.js delete <username> --yes   actually delete (cascades all data)
  node scripts/db-admin.js rename <old> <new>        rename a username`);
  }
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
