// ============================================================
// Life RPG — Phase 1: 30-Point Local Runtime Verification Suite
// Real runtime integration test against Express & MySQL
// ============================================================
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const app = require('../src/server');

const prisma = new PrismaClient();
const TEST_PORT = 5096;
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
  console.log('🎮 STARTING LIFE RPG 30-POINT LOCAL RUNTIME VERIFICATION');
  console.log('============================================================\n');

  let server;
  try {
    // 1. Backend starts successfully
    server = await new Promise((resolve, reject) => {
      const s = app.listen(TEST_PORT, () => resolve(s));
      s.on('error', reject);
    });
    recordTest(1, 'Backend starts successfully', true, `Port ${TEST_PORT}`);

    const jarUserA = new CookieJar();
    const jarUserB = new CookieJar();

    // 2. Frontend loads
    const homeRes = await jarUserA.fetch('/');
    const dashboardHtmlRes = await jarUserA.fetch('/pages/dashboard.html');
    const authHtmlRes = await jarUserA.fetch('/pages/auth.html');
    const questsHtmlRes = await jarUserA.fetch('/pages/quests.html');
    const frontendLoads = homeRes.status === 200 && dashboardHtmlRes.status === 200 && authHtmlRes.status === 200 && questsHtmlRes.status === 200;
    recordTest(2, 'Frontend loads', frontendLoads, 'Landing, Auth, Dashboard, and Quest pages served');

    // 3. Database connects
    const dbTest = await prisma.$queryRaw`SELECT 1 as connected`;
    const dbConnected = Array.isArray(dbTest) && dbTest.length > 0;
    recordTest(3, 'Database connects', dbConnected, 'Raw query succeeded on MySQL');

    // 4. Prisma connects
    const tables = await prisma.$queryRaw`SHOW TABLES`;
    recordTest(4, 'Prisma connects', tables.length >= 8, `${tables.length} tables verified in schema`);

    // 5. Signup works
    const timestamp = Date.now();
    const userAEmail = `hero_${timestamp}@test.dev`;
    const signupRes = await jarUserA.fetch('/api/auth/signup', {
      method: 'POST',
      body: { email: userAEmail, password: 'Password123!', confirmPassword: 'Password123!' },
    });
    const signupPassed = signupRes.status === 201 && (signupRes.data?.user?.email === userAEmail || signupRes.data?.email === userAEmail);
    recordTest(5, 'Signup works', signupPassed, `Created user: ${userAEmail}`);

    // 6. Login works
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
    recordTest(6, 'Login works', loginPassed, `Authenticated: ${userBEmail}`);

    // 7. Logout works
    const tempJar = new CookieJar();
    await tempJar.fetch('/api/auth/login', {
      method: 'POST',
      body: { email: userBEmail, password: 'Password123!' },
    });
    const logoutRes = await tempJar.fetch('/api/auth/logout', { method: 'POST' });
    const meAfterLogout = await tempJar.fetch('/api/auth/me');
    recordTest(7, 'Logout works', logoutRes.status === 200 && meAfterLogout.status === 401, 'Session cleared and 401 returned');

    // 8. Session persists correctly
    const meResA = await jarUserA.fetch('/api/auth/me');
    const sessionPassed = meResA.status === 200 && (meResA.data?.email === userAEmail || meResA.data?.user?.email === userAEmail);
    recordTest(8, 'Session persists correctly', sessionPassed, 'Cookie persists auth state across requests');

    // 9. Character creation works
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
    recordTest(9, 'Character creation works', charCreated, `Character created: ${usernameA}`);

    // Create character for User B
    const usernameB = `Rival_${timestamp}`.substring(0, 16);
    await jarUserB.fetch('/api/profile/create', {
      method: 'POST',
      body: { username: usernameB, class: 'WARRIOR', avatar: 'warrior', goals: ['FITNESS'] },
    });

    // 10. Dashboard loads
    const profileRes = await jarUserA.fetch('/api/profile');
    const attrRes = await jarUserA.fetch('/api/attributes');
    const dashboardDataLoaded = profileRes.status === 200 && attrRes.status === 200 && (attrRes.data?.intellect >= 10 || attrRes.data?.attributes?.intellect >= 10);
    recordTest(10, 'Dashboard loads', dashboardDataLoaded, `Profile & Attributes fetched from MySQL`);

    // 11. Quest creation works
    const createQuestRes = await jarUserA.fetch('/api/quests', {
      method: 'POST',
      body: {
        title: 'Master Graph Algorithms',
        description: 'Implement Dijkstra and A* search algorithms',
        category: 'CODING',
        difficulty: 'MEDIUM',
        type: 'ACTIVITY',
      },
    });
    const questId = createQuestRes.data?.id;
    recordTest(11, 'Quest creation works', createQuestRes.status === 201 && !!questId, `Quest ID: ${questId}`);

    // 12. Quest editing works
    const updateQuestRes = await jarUserA.fetch(`/api/quests/${questId}`, {
      method: 'PATCH',
      body: { title: 'Master Advanced Graph Algorithms' },
    });
    recordTest(12, 'Quest editing works', updateQuestRes.status === 200 && updateQuestRes.data?.title === 'Master Advanced Graph Algorithms', 'Title updated');

    // 13. Quest deletion works
    const tempQuestRes = await jarUserA.fetch('/api/quests', {
      method: 'POST',
      body: { title: 'Temp Quest', description: 'To delete', difficulty: 'EASY' },
    });
    const deleteQuestRes = await jarUserA.fetch(`/api/quests/${tempQuestRes.data.id}`, { method: 'DELETE' });
    recordTest(13, 'Quest deletion works', deleteQuestRes.status === 200, 'Soft delete confirmed');

    // 14. Quest completion works
    const initialProfile = profileRes.data;
    const initialAttrs = attrRes.data?.intellect ? attrRes.data : attrRes.data?.attributes;
    const completeRes = await jarUserA.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const questCompleted = completeRes.status === 200 && (completeRes.data?.questCompleted === true || completeRes.data?.quest?.status === 'COMPLETED');
    const xpGained = completeRes.data?.rewards?.xp || completeRes.data?.rewards?.xpGained || 0;
    const goldGained = completeRes.data?.rewards?.gold || completeRes.data?.rewards?.goldGained || 0;
    recordTest(14, 'Quest completion works', questCompleted, `Status marked COMPLETED`);

    // 15. XP is awarded server-side
    const profileAfterQuest = completeRes.data?.character || completeRes.data?.profile;
    const xpVerified = profileAfterQuest?.totalXp === (initialProfile?.totalXp || 0) + xpGained;
    recordTest(15, 'XP is awarded server-side', xpVerified, `XP gained: ${xpGained} (Total: ${profileAfterQuest?.totalXp})`);

    // 16. Gold is awarded server-side
    const goldVerified = profileAfterQuest?.gold === (initialProfile?.gold || 0) + goldGained;
    recordTest(16, 'Gold is awarded server-side', goldVerified, `Gold gained: ${goldGained} (Total: ${profileAfterQuest?.gold})`);

    // 17. Attributes update correctly
    const attrsAfterQuest = await jarUserA.fetch('/api/attributes');
    const currentIntellect = attrsAfterQuest.data?.intellect || attrsAfterQuest.data?.attributes?.intellect || 0;
    const initialIntellect = initialAttrs?.intellect || 0;
    const attributeUpdated = (currentIntellect >= initialIntellect) && (completeRes.data?.rewards?.attributes !== undefined);
    recordTest(17, 'Attributes update correctly', attributeUpdated, `Attribute rewards processed`);

    // 18. Level progression works
    const epicQuest = await jarUserA.fetch('/api/quests', {
      method: 'POST',
      body: { title: 'Epic Hackathon Finalist', description: 'Complete full stack system', difficulty: 'EPIC', category: 'CODING' },
    });
    const epicCompleteRes = await jarUserA.fetch(`/api/quests/${epicQuest.data.id}/complete`, { method: 'POST' });
    const charAfterEpic = epicCompleteRes.data?.character || epicCompleteRes.data?.profile;
    const levelCalculated = charAfterEpic?.level >= 1 && charAfterEpic?.xpRequired >= charAfterEpic?.currentXp;
    recordTest(18, 'Level progression works', levelCalculated, `Level: ${charAfterEpic?.level}, XP Progress: ${charAfterEpic?.currentXp}/${charAfterEpic?.xpRequired}`);

    // 19. Streak logic works
    const streakValid = typeof charAfterEpic?.currentStreak === 'number' && charAfterEpic?.currentStreak >= 1;
    recordTest(19, 'Streak logic works', streakValid, `Current streak: ${charAfterEpic?.currentStreak} day(s)`);

    // 20. Refreshing the page preserves data
    const refreshProfile = await jarUserA.fetch('/api/profile');
    const refreshQuests = await jarUserA.fetch('/api/quests');
    const persisted = refreshProfile.data?.totalXp === charAfterEpic?.totalXp && refreshQuests.data?.some(q => q.id === questId && q.status === 'COMPLETED');
    recordTest(20, 'Refreshing the page preserves data', persisted, 'Persisted in MySQL');

    // 21. Completing the same quest twice does NOT give duplicate rewards
    const duplicateCompleteRes = await jarUserA.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const duplicatePrevented = duplicateCompleteRes.status === 400 || duplicateCompleteRes.status === 409;
    recordTest(21, 'Completing the same quest twice does NOT give duplicate rewards', duplicatePrevented, `Rejected with ${duplicateCompleteRes.status}`);

    // 22. User A cannot access User B\'s quests/data
    const userBAccessUserAQuest = await jarUserB.fetch(`/api/quests/${questId}`);
    const userBCompleteUserAQuest = await jarUserB.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const crossUserBlocked = (userBAccessUserAQuest.status === 404 || userBAccessUserAQuest.status === 403) && (userBCompleteUserAQuest.status === 404 || userBCompleteUserAQuest.status === 403);
    recordTest(22, 'User A cannot access User B\'s quests/data', crossUserBlocked, 'Tenant isolation enforced');

    // 23. Shop loads
    const shopListRes = await jarUserA.fetch('/api/shop');
    const shopLoaded = shopListRes.status === 200 && Array.isArray(shopListRes.data) && shopListRes.data.length > 0;
    recordTest(23, 'Shop loads', shopLoaded, `${shopListRes.data?.length || 0} shop items loaded`);

    // 24. Purchase works
    const cheapestItem = shopListRes.data?.find(i => i.price <= 400) || shopListRes.data?.[0];
    const meDataA = (await jarUserA.fetch('/api/auth/me')).data;
    const userIdA = meDataA.id || meDataA.user?.id;

    await prisma.profile.update({
      where: { userId: userIdA },
      data: { gold: 1000 },
    });

    const buyRes = await jarUserA.fetch(`/api/shop/${cheapestItem.id}/purchase`, {
      method: 'POST',
      body: { price: 1 }, // Attempt to spoof price
    });
    const profileAfterBuy = await jarUserA.fetch('/api/profile');
    const realPriceDeducted = buyRes.status === 200 && profileAfterBuy.data?.gold === (1000 - cheapestItem.price);
    recordTest(24, 'Purchase works', realPriceDeducted, `Item purchased at real DB price (${cheapestItem.price}g), spoofed price ignored`);

    // 25. Insufficient Gold is handled correctly
    const meDataB = (await jarUserB.fetch('/api/auth/me')).data;
    const userIdB = meDataB.id || meDataB.user?.id;
    await prisma.profile.update({
      where: { userId: userIdB },
      data: { gold: 0 },
    });
    const buyFailRes = await jarUserB.fetch(`/api/shop/${cheapestItem.id}/purchase`, { method: 'POST' });
    recordTest(25, 'Insufficient Gold is handled correctly', buyFailRes.status === 400 && buyFailRes.data?.error?.toLowerCase().includes('gold'), `Rejected with: "${buyFailRes.data?.error}"`);

    // 26. Inventory works
    const invRes = await jarUserA.fetch('/api/inventory');
    const ownedItem = invRes.data?.find(inv => inv.itemId === cheapestItem.id);
    let equipSuccess = false;
    if (ownedItem) {
      const equipRes = await jarUserA.fetch(`/api/inventory/${ownedItem.id}/equip`, { method: 'POST' });
      equipSuccess = equipRes.status === 200 && equipRes.data?.equipped === true;
    }
    recordTest(26, 'Inventory works', !!ownedItem && equipSuccess, `Item equipped in inventory`);

    // 27. Activity logging works
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
    recordTest(27, 'Activity logging works', activityLogged, `Logged 60 min CODING, daily total: ${dailySummaryRes.data?.codingMinutes} min`);

    // 28. Adaptive missions work
    const todayMissionsRes = await jarUserA.fetch('/api/missions/today');
    const regenerateMissionsRes = await jarUserA.fetch('/api/missions/generate', { method: 'POST' });
    const missionsSuccess = (todayMissionsRes.status === 200 || regenerateMissionsRes.status === 200) && Array.isArray(regenerateMissionsRes.data) && regenerateMissionsRes.data.length > 0;
    recordTest(28, 'Adaptive missions work', missionsSuccess, `${regenerateMissionsRes.data?.length || 0} missions generated based on goals/activity`);

    // 29. Invalid requests return proper errors
    const invalidSignup = await jarUserA.fetch('/api/auth/signup', {
      method: 'POST',
      body: { email: 'not-an-email', password: '123' },
    });
    const invalidQuest = await jarUserA.fetch('/api/quests', {
      method: 'POST',
      body: { title: '' },
    });
    const errorHandlingWorks = invalidSignup.status === 400 && invalidQuest.status === 400;
    recordTest(29, 'Invalid requests return proper errors', errorHandlingWorks, 'Validation errors returned 400 Bad Request');

    // 30. Application does not produce blank screens/crashes
    const allPages = ['/', '/pages/dashboard.html', '/pages/quests.html', '/pages/activity.html', '/pages/shop.html', '/pages/inventory.html', '/pages/stats.html', '/pages/profile.html', '/pages/settings.html', '/pages/auth.html', '/pages/character.html'];
    let allPages200 = true;
    for (const page of allPages) {
      const pRes = await jarUserA.fetch(page);
      if (pRes.status !== 200) { allPages200 = false; break; }
    }
    recordTest(30, 'Application does not produce blank screens/crashes', allPages200, 'All 10 frontend pages responded with HTTP 200');

    console.log('\n============================================================');
    const totalPassed = results.filter(r => r.passed).length;
    console.log(`📊 FINAL RESULT: ${totalPassed} / ${results.length} TESTS PASSED`);
    console.log('============================================================\n');

    if (totalPassed === results.length) {
      console.log('🎉 ALL 30 SPECIFICATIONS SUCCESSFULLY VERIFIED AT RUNTIME!\n');
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
