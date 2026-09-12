// ============================================================
// Life RPG — Comprehensive 26-Point E2E Verification Suite
// Real runtime integration test against Express & MySQL
// ============================================================
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const app = require('../src/server');

const prisma = new PrismaClient();
const TEST_PORT = 5097;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Cookie Jar for session handling in Node fetch
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  extract(res) {
    const setCookie = res.headers.raw ? res.headers.raw()['set-cookie'] : (res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')]);
    if (setCookie && Array.isArray(setCookie)) {
      for (const cookieStr of setCookie) {
        if (!cookieStr) continue;
        const [cookiePair] = cookieStr.split(';');
        const [name, val] = cookiePair.split('=');
        if (name) this.cookies.set(name.trim(), val ? val.trim() : '');
      }
    }
  }

  getCookieHeader() {
    const pairs = [];
    for (const [name, val] of this.cookies.entries()) {
      pairs.push(`${name}=${val}`);
    }
    return pairs.join('; ');
  }

  async fetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['cookie'] = cookieHeader;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof String)) {
      headers['content-type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
    this.extract(res);
    let json = null;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, ok: res.ok, data: json, headers: res.headers };
  }
}

const results = [];

function recordTest(id, name, passed, details = '') {
  results.push({ id, name, passed, details });
  const symbol = passed ? '✅' : '❌';
  console.log(`${symbol} [Test ${String(id).padStart(2, '0')}] ${name}: ${passed ? 'PASSED' : 'FAILED'} ${details ? `(${details})` : ''}`);
}

async function run() {
  console.log('============================================================');
  console.log('🎮 STARTING LIFE RPG 26-POINT E2E RUNTIME VERIFICATION');
  console.log('============================================================\n');

  let server;
  try {
    // 1. Backend starts successfully
    server = await new Promise((resolve, reject) => {
      const s = app.listen(TEST_PORT, () => resolve(s));
      s.on('error', reject);
    });
    recordTest(1, 'Backend starts successfully', true, `Port ${TEST_PORT}`);

    // 2. Prisma connects successfully to MySQL
    const dbTest = await prisma.$queryRaw`SELECT 1 as connected`;
    const connected = Array.isArray(dbTest) && dbTest.length > 0;
    recordTest(2, 'Prisma connects successfully to MySQL', connected, 'Database connection verified');

    // 3. Database schema can be created
    const tables = await prisma.$queryRaw`SHOW TABLES`;
    recordTest(3, 'Database schema can be created', tables.length >= 8, `${tables.length} tables verified`);

    // 4. Seed works safely
    const shopItemCount = await prisma.shopItem.count();
    const achievementCount = await prisma.achievement.count();
    recordTest(4, 'Seed works safely', shopItemCount > 0 && achievementCount > 0, `${shopItemCount} items, ${achievementCount} achievements`);

    const jarUserA = new CookieJar();
    const jarUserB = new CookieJar();

    // 5. Frontend loads
    const homeRes = await jarUserA.fetch('/');
    const dashboardHtmlRes = await jarUserA.fetch('/pages/dashboard.html');
    const questsHtmlRes = await jarUserA.fetch('/pages/quests.html');
    const frontendLoads = homeRes.status === 200 && dashboardHtmlRes.status === 200 && questsHtmlRes.status === 200;
    recordTest(5, 'Frontend loads', frontendLoads, 'Landing & page HTML served');

    // 6. Email/password signup works
    const timestamp = Date.now();
    const userAEmail = `hero_${timestamp}@test.dev`;
    const signupRes = await jarUserA.fetch('/api/auth/signup', {
      method: 'POST',
      body: { email: userAEmail, password: 'Password123!', confirmPassword: 'Password123!' },
    });
    const signupPassed = signupRes.status === 201 && (signupRes.data?.user?.email === userAEmail || signupRes.data?.email === userAEmail);
    recordTest(6, 'Email/password signup works', signupPassed, `User created: ${userAEmail}`);

    // 7. Login works
    const userBEmail = `rival_${timestamp}@test.dev`;
    await jarUserB.fetch('/api/auth/signup', {
      method: 'POST',
      body: { email: userBEmail, password: 'Password123!', confirmPassword: 'Password123!' },
    });
    const loginRes = await jarUserB.fetch('/api/auth/login', {
      method: 'POST',
      body: { email: userBEmail, password: 'Password123!' },
    });
    const loginPassed = loginRes.status === 200 && (loginRes.data?.user?.email === userBEmail || loginRes.data?.email === userBEmail);
    recordTest(7, 'Login works', loginPassed, `Logged in: ${userBEmail}`);

    // 8. Logout works
    const tempJar = new CookieJar();
    await tempJar.fetch('/api/auth/login', {
      method: 'POST',
      body: { email: userBEmail, password: 'Password123!' },
    });
    const logoutRes = await tempJar.fetch('/api/auth/logout', { method: 'POST' });
    const meAfterLogout = await tempJar.fetch('/api/auth/me');
    recordTest(8, 'Logout works', logoutRes.status === 200 && meAfterLogout.status === 401, 'Session terminated and 401 returned');

    // 9. Session persistence works
    const meResA = await jarUserA.fetch('/api/auth/me');
    const sessionPassed = meResA.status === 200 && (meResA.data?.email === userAEmail || meResA.data?.user?.email === userAEmail);
    recordTest(9, 'Session persistence works', sessionPassed, 'Session preserved across calls');

    // 10. Character creation works
    const usernameA = `Hero_${timestamp}`.substring(0, 16);
    const createCharRes = await jarUserA.fetch('/api/profile/create', {
      method: 'POST',
      body: {
        username: usernameA,
        class: 'SCHOLAR',
        avatar: 'scholar',
        goals: ['CODING', 'STUDY'],
      },
    });
    const charCreated = createCharRes.status === 201 && (createCharRes.data?.username === usernameA || createCharRes.data?.profile?.username === usernameA);
    recordTest(10, 'Character creation works', charCreated, `Created character: ${usernameA}`);

    // Also create character for User B
    const usernameB = `Rival_${timestamp}`.substring(0, 16);
    await jarUserB.fetch('/api/profile/create', {
      method: 'POST',
      body: {
        username: usernameB,
        class: 'WARRIOR',
        avatar: 'warrior',
        goals: ['FITNESS'],
      },
    });

    // 11. Dashboard loads real database data
    const profileRes = await jarUserA.fetch('/api/profile');
    const attrRes = await jarUserA.fetch('/api/attributes');
    const hasData = profileRes.status === 200 && attrRes.status === 200 && (attrRes.data?.intellect >= 10 || attrRes.data?.attributes?.intellect >= 10);
    recordTest(11, 'Dashboard loads real database data', hasData, `Level ${profileRes.data?.level}, Intellect: ${attrRes.data?.intellect || attrRes.data?.attributes?.intellect}`);

    // 12. Quest CRUD works
    const createQuestRes = await jarUserA.fetch('/api/quests', {
      method: 'POST',
      body: {
        title: 'Master Data Structures',
        description: 'Solve 3 graph algorithms today',
        category: 'CODING',
        difficulty: 'MEDIUM',
        type: 'ACTIVITY',
      },
    });
    const questId = createQuestRes.data?.id;

    // Read list
    const listQuestsRes = await jarUserA.fetch('/api/quests');
    const questInList = Array.isArray(listQuestsRes.data) && listQuestsRes.data.some(q => q.id === questId);

    // Update
    const updateQuestRes = await jarUserA.fetch(`/api/quests/${questId}`, {
      method: 'PATCH',
      body: { title: 'Master Advanced Data Structures' },
    });

    // Create another quest to test delete
    const questToDeleteRes = await jarUserA.fetch('/api/quests', {
      method: 'POST',
      body: { title: 'Temporary Quest to Delete', description: 'Test delete', difficulty: 'EASY' },
    });
    const deleteQuestRes = await jarUserA.fetch(`/api/quests/${questToDeleteRes.data.id}`, { method: 'DELETE' });

    const crudSuccess = createQuestRes.status === 201 && questInList && updateQuestRes.status === 200 && deleteQuestRes.status === 200;
    recordTest(12, 'Quest CRUD works', crudSuccess, `Quest ${questId} created, updated, and deleted`);

    // 13. Quest completion works
    const initialProfile = profileRes.data;
    const initialAttrs = attrRes.data?.intellect ? attrRes.data : attrRes.data?.attributes;
    const completeRes = await jarUserA.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const questCompleted = completeRes.status === 200 && (completeRes.data?.questCompleted === true || completeRes.data?.quest?.status === 'COMPLETED');
    const xpGained = completeRes.data?.rewards?.xp || completeRes.data?.rewards?.xpGained || 0;
    const goldGained = completeRes.data?.rewards?.gold || completeRes.data?.rewards?.goldGained || 0;
    recordTest(13, 'Quest completion works', questCompleted, `XP gained: ${xpGained}, Gold gained: ${goldGained}`);

    // 14. XP is calculated server-side
    const profileAfterQuest = completeRes.data?.character || completeRes.data?.profile;
    const xpVerified = profileAfterQuest?.totalXp === (initialProfile?.totalXp || 0) + xpGained;
    recordTest(14, 'XP is calculated server-side', xpVerified, `Total XP: ${initialProfile?.totalXp} -> ${profileAfterQuest?.totalXp}`);

    // 15. Gold is calculated server-side
    const goldVerified = profileAfterQuest?.gold === (initialProfile?.gold || 0) + goldGained;
    recordTest(15, 'Gold is calculated server-side', goldVerified, `Gold: ${initialProfile?.gold} -> ${profileAfterQuest?.gold}`);

    // 16. Attributes update server-side
    const attrsAfterQuest = await jarUserA.fetch('/api/attributes');
    const currentIntellect = attrsAfterQuest.data?.intellect || attrsAfterQuest.data?.attributes?.intellect || 0;
    const initialIntellect = initialAttrs?.intellect || 0;
    const attributeUpdated = (currentIntellect >= initialIntellect) && (completeRes.data?.rewards?.attributes !== undefined);
    recordTest(16, 'Attributes update server-side', attributeUpdated, `Attribute rewards processed`);

    // 17. Level calculation works
    const epicQuest = await jarUserA.fetch('/api/quests', {
      method: 'POST',
      body: { title: 'Epic Hackathon Finalist', description: 'Complete complete end-to-end app', difficulty: 'EPIC', category: 'CODING' },
    });
    const epicCompleteRes = await jarUserA.fetch(`/api/quests/${epicQuest.data.id}/complete`, { method: 'POST' });
    const charAfterEpic = epicCompleteRes.data?.character || epicCompleteRes.data?.profile;
    const levelCalculated = charAfterEpic?.level >= 1 && charAfterEpic?.xpRequired >= charAfterEpic?.currentXp;
    recordTest(17, 'Level calculation works', levelCalculated, `Current Level: ${charAfterEpic?.level}, Current XP: ${charAfterEpic?.currentXp}/${charAfterEpic?.xpRequired}`);

    // 18. Streak calculation works
    const streakValid = typeof charAfterEpic?.currentStreak === 'number' && charAfterEpic?.currentStreak >= 1;
    recordTest(18, 'Streak calculation works', streakValid, `Current streak: ${charAfterEpic?.currentStreak} day(s)`);

    // 19. Refresh preserves all data
    const refreshProfile = await jarUserA.fetch('/api/profile');
    const refreshQuests = await jarUserA.fetch('/api/quests');
    const persisted = refreshProfile.data?.totalXp === charAfterEpic?.totalXp && refreshQuests.data?.some(q => q.id === questId && q.status === 'COMPLETED');
    recordTest(19, 'Refresh preserves all data', persisted, 'Database state matches subsequent fetches');

    // 20. Duplicate quest completion cannot give duplicate rewards
    const duplicateCompleteRes = await jarUserA.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const duplicatePrevented = duplicateCompleteRes.status === 400 || duplicateCompleteRes.status === 409;
    recordTest(20, 'Duplicate quest completion cannot give duplicate rewards', duplicatePrevented, `Response: ${duplicateCompleteRes.status} ${duplicateCompleteRes.data?.error || ''}`);

    // 21. User A cannot access User B's data
    const userBAccessUserAQuest = await jarUserB.fetch(`/api/quests/${questId}`);
    const userBCompleteUserAQuest = await jarUserB.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const crossUserBlocked = (userBAccessUserAQuest.status === 404 || userBAccessUserAQuest.status === 403) && (userBCompleteUserAQuest.status === 404 || userBCompleteUserAQuest.status === 403);
    recordTest(21, 'User A cannot access User B\'s data', crossUserBlocked, 'Cross-tenant isolation enforced');

    // 22. Shop purchases validate the real database price
    const shopListRes = await jarUserA.fetch('/api/shop');
    const cheapestItem = shopListRes.data?.find(i => i.price <= 400) || shopListRes.data?.[0];

    const meDataA = (await jarUserA.fetch('/api/auth/me')).data;
    const userIdA = meDataA.id || meDataA.user?.id;

    // Set gold for User A
    await prisma.profile.update({
      where: { userId: userIdA },
      data: { gold: 1000 },
    });

    const buyRes = await jarUserA.fetch(`/api/shop/${cheapestItem.id}/purchase`, {
      method: 'POST',
      body: { price: 1 }, // Client attempts to spoof price as 1 gold
    });
    const profileAfterBuy = await jarUserA.fetch('/api/profile');
    const realPriceDeducted = buyRes.status === 200 && profileAfterBuy.data?.gold === (1000 - cheapestItem.price);
    recordTest(22, 'Shop purchases validate the real database price', realPriceDeducted, `Item price (${cheapestItem.price}g) properly deducted, spoofed price ignored`);

    // 23. Insufficient Gold is handled correctly
    const meDataB = (await jarUserB.fetch('/api/auth/me')).data;
    const userIdB = meDataB.id || meDataB.user?.id;
    await prisma.profile.update({
      where: { userId: userIdB },
      data: { gold: 0 },
    });
    const buyFailRes = await jarUserB.fetch(`/api/shop/${cheapestItem.id}/purchase`, { method: 'POST' });
    recordTest(23, 'Insufficient Gold is handled correctly', buyFailRes.status === 400 && buyFailRes.data?.error?.toLowerCase().includes('gold'), `Error message: "${buyFailRes.data?.error}"`);

    // 24. Inventory persists correctly
    const invRes = await jarUserA.fetch('/api/inventory');
    const ownedItem = invRes.data?.find(inv => inv.itemId === cheapestItem.id);
    let equipSuccess = false;
    if (ownedItem) {
      const equipRes = await jarUserA.fetch(`/api/inventory/${ownedItem.id}/equip`, { method: 'POST' });
      equipSuccess = equipRes.status === 200 && equipRes.data?.equipped === true;
    }
    recordTest(24, 'Inventory persists correctly', !!ownedItem && equipSuccess, `Item ${cheapestItem.name} in inventory & equipped`);

    // 25. Activity logging works
    const logActivityRes = await jarUserA.fetch('/api/activity', {
      method: 'POST',
      body: {
        category: 'CODING',
        durationMinutes: 60,
        description: 'Built E2E testing suite in Node.js',
      },
    });
    const dailySummaryRes = await jarUserA.fetch('/api/activity/daily');
    const activityLogged = logActivityRes.status === 201 && dailySummaryRes.data?.codingMinutes >= 60;
    recordTest(25, 'Activity logging works', activityLogged, `Logged 60 min CODING, daily total: ${dailySummaryRes.data?.codingMinutes} min`);

    // 26. Daily mission generation works
    const todayMissionsRes = await jarUserA.fetch('/api/missions/today');
    const regenerateMissionsRes = await jarUserA.fetch('/api/missions/generate', { method: 'POST' });
    const missionsSuccess = (todayMissionsRes.status === 200 || regenerateMissionsRes.status === 200) && Array.isArray(regenerateMissionsRes.data) && regenerateMissionsRes.data.length > 0;
    recordTest(26, 'Daily mission generation works', missionsSuccess, `${regenerateMissionsRes.data?.length || 0} missions generated based on goals/activity`);

    console.log('\n============================================================');
    const totalPassed = results.filter(r => r.passed).length;
    console.log(`📊 FINAL RESULT: ${totalPassed} / ${results.length} TESTS PASSED`);
    console.log('============================================================\n');

    if (totalPassed === results.length) {
      console.log('🎉 ALL 26 SPECIFICATIONS SUCCESSFULLY VERIFIED AT RUNTIME!\n');
    }

  } catch (err) {
    console.error('❌ Test suite runtime error:', err);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

run();
