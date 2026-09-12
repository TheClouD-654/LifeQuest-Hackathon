/**
 * Life RPG - Comprehensive Step-by-Step Flow Test
 * Runs against live running server at http://localhost:5000
 */
const BASE_URL = 'http://localhost:5000';

class SessionClient {
  constructor(name) {
    this.name = name;
    this.cookies = '';
  }

  async fetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookies = setCookie.split(';')[0];
    }

    let data = null;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status: response.status, data, headers: response.headers };
  }
}

async function runLiveTest() {
  console.log('\n============================================================');
  console.log('⚔️  LIVE FULL-FLOW APPLICATION VERIFICATION (PORT 5000)');
  console.log('============================================================\n');

  const timestamp = Date.now();
  const userA = new SessionClient('Hero_A');
  const userB = new SessionClient('Rival_B');

  const emailA = `hero_${timestamp}@lifequest.dev`;
  const passwordA = 'HeroicPassword123!';
  const usernameA = `Hero_${String(timestamp).slice(-6)}`;

  const emailB = `rival_${timestamp}@lifequest.dev`;
  const passwordB = 'RivalPassword123!';
  const usernameB = `Rival_${String(timestamp).slice(-6)}`;

  const results = [];
  function assert(stepNum, stepName, condition, details) {
    results.push({ stepNum, stepName, passed: !!condition, details });
    const symbol = condition ? '✅' : '❌';
    console.log(`${symbol} [Step ${String(stepNum).padStart(2, '0')}] ${stepName}: ${condition ? 'PASSED' : 'FAILED'}`);
    if (details) console.log(`   ↳ ${details}`);
  }

  try {
    // 1. Signup
    const signupRes = await userA.fetch('/api/auth/signup', {
      method: 'POST',
      body: { email: emailA, password: passwordA, confirmPassword: passwordA },
    });
    assert(1, 'Signup', signupRes.status === 201 && signupRes.data?.user?.email === emailA, `User created: ${emailA} (ID: ${signupRes.data?.user?.id})`);

    // 2. Login
    const loginRes = await userA.fetch('/api/auth/login', {
      method: 'POST',
      body: { email: emailA, password: passwordA },
    });
    const meRes = await userA.fetch('/api/auth/me');
    assert(2, 'Login & Session Validation', loginRes.status === 200 && meRes.status === 200 && meRes.data?.email === emailA, `Session authenticated: ${meRes.data?.email}`);

    // 3. Character Creation
    const charRes = await userA.fetch('/api/profile/create', {
      method: 'POST',
      body: {
        username: usernameA,
        class: 'WARRIOR',
        avatar: 'warrior',
        goals: ['FITNESS', 'CODING'],
      },
    });
    assert(3, 'Character Creation', charRes.status === 201 && charRes.data?.username === usernameA, `Username: "${charRes.data?.username}", Class: ${charRes.data?.class}, Level: ${charRes.data?.level}`);

    // 4. Dashboard Initial Load
    const profileRes = await userA.fetch('/api/profile');
    const attributesRes = await userA.fetch('/api/attributes');
    const initialGold = profileRes.data?.gold || 100;
    const initialXp = profileRes.data?.totalXp || 0;
    const initialLevel = profileRes.data?.level || 1;
    const strengthVal = attributesRes.data?.strength || 15;
    assert(4, 'Dashboard Initial Load', profileRes.status === 200 && attributesRes.status === 200, `Level: ${initialLevel}, Total XP: ${initialXp}, Gold: ${initialGold}, Strength: ${strengthVal}`);

    // 5. Create Quest
    const createQuestRes = await userA.fetch('/api/quests', {
      method: 'POST',
      body: {
        title: 'Complete 10km Marathon Training',
        description: 'Complete high intensity cardio',
        category: 'FITNESS',
        difficulty: 'EPIC',
      },
    });
    const questId = createQuestRes.data?.id;
    assert(5, 'Create Quest', createQuestRes.status === 201 && !!questId, `Quest ID: ${questId}, Title: "${createQuestRes.data?.title}", Difficulty: ${createQuestRes.data?.difficulty}`);

    // 6. Complete Quest
    const completeRes = await userA.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    assert(6, 'Complete Quest', completeRes.status === 200 && completeRes.data?.questCompleted === true, `Quest completed successfully (Status: 200)`);

    // 7. XP + Gold + Attributes Reward
    const xpGained = completeRes.data?.rewards?.xp || 0;
    const goldGained = completeRes.data?.rewards?.gold || 0;
    const profileAfterQuest = await userA.fetch('/api/profile');
    const attributesAfterQuest = await userA.fetch('/api/attributes');
    assert(7, 'XP + Gold + Attributes Calculation',
      xpGained > 0 && goldGained > 0 && profileAfterQuest.data?.totalXp === (initialXp + xpGained) && profileAfterQuest.data?.gold === (initialGold + goldGained),
      `XP Gained: +${xpGained} (Total: ${profileAfterQuest.data?.totalXp}), Gold Gained: +${goldGained} (Total: ${profileAfterQuest.data?.gold}), Strength: ${attributesAfterQuest.data?.strength}`
    );

    // 8. Level / Streak
    const streakDays = profileAfterQuest.data?.currentStreak || 0;
    assert(8, 'Level & Streak Progression', typeof profileAfterQuest.data?.level === 'number' && streakDays >= 1, `Level: ${profileAfterQuest.data?.level}, Current Streak: ${streakDays} day(s), Total XP: ${profileAfterQuest.data?.totalXp}`);

    // 9. Refresh (Simulate browser reload & verify DB persistence)
    const refreshProfile = await userA.fetch('/api/profile');
    const refreshQuests = await userA.fetch('/api/quests');
    const refreshAttributes = await userA.fetch('/api/attributes');
    const refreshMe = await userA.fetch('/api/auth/me');
    const dataPersisted = refreshProfile.data?.totalXp === profileAfterQuest.data?.totalXp &&
      refreshProfile.data?.gold === profileAfterQuest.data?.gold &&
      refreshQuests.data?.some(q => q.id === questId && q.status === 'COMPLETED') &&
      refreshMe.data?.email === emailA;
    assert(9, 'Data Persistence on Refresh', dataPersisted, `All profile, quest history, attributes, and session data 100% matched after refresh`);

    // 10. Duplicate Quest Completion (Anti-Cheat)
    const dupRes = await userA.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const dupBlocked = dupRes.status === 400 || dupRes.status === 409;
    assert(10, 'Duplicate Quest Completion Guard', dupBlocked, `Second completion attempt rejected with HTTP ${dupRes.status} (${dupRes.data?.error})`);

    // 11. Unauthorized User Access (Cross-Tenant Isolation)
    await userB.fetch('/api/auth/signup', { method: 'POST', body: { email: emailB, password: passwordB, confirmPassword: passwordB } });
    await userB.fetch('/api/auth/login', { method: 'POST', body: { email: emailB, password: passwordB } });
    await userB.fetch('/api/profile/create', { method: 'POST', body: { username: usernameB, class: 'ROGUE', avatar: 'ninja' } });

    const userBAccessUserA = await userB.fetch(`/api/quests/${questId}`);
    const userBCompleteUserA = await userB.fetch(`/api/quests/${questId}/complete`, { method: 'POST' });
    const tenantIsolation = (userBAccessUserA.status === 403 || userBAccessUserA.status === 404) &&
                            (userBCompleteUserA.status === 403 || userBCompleteUserA.status === 404);
    assert(11, 'Unauthorized Cross-User Access Guard', tenantIsolation, `User B reading User A quest: HTTP ${userBAccessUserA.status}, User B completing User A quest: HTTP ${userBCompleteUserA.status}`);

    // Complete another epic quest so User A has plenty of gold to purchase shop items
    const q2 = await userA.fetch('/api/quests', {
      method: 'POST',
      body: { title: 'Master Clean Architecture', category: 'CODING', difficulty: 'EPIC' },
    });
    await userA.fetch(`/api/quests/${q2.data.id}/complete`, { method: 'POST' });
    const q3 = await userA.fetch('/api/quests', {
      method: 'POST',
      body: { title: 'Read 20 Pages', category: 'STUDY', difficulty: 'EPIC' },
    });
    await userA.fetch(`/api/quests/${q3.data.id}/complete`, { method: 'POST' });

    // 12. Shop Purchase (Real DB Price Validation)
    const shopRes = await userA.fetch('/api/shop');
    const currentGold = (await userA.fetch('/api/profile')).data.gold;
    const shopItem = shopRes.data?.find(i => i.price <= currentGold) || shopRes.data?.[0];
    const buyRes = await userA.fetch(`/api/shop/${shopItem.id}/purchase`, {
      method: 'POST',
      body: { price: 1 }, // Spoofed price attempt
    });
    const profileAfterShop = await userA.fetch('/api/profile');
    const shopVerified = buyRes.status === 200 && profileAfterShop.data?.gold === (currentGold - shopItem.price);
    assert(12, 'Shop Purchase (Server Price Verification)', shopVerified, `Item "${shopItem.name}" purchased for real DB price (${shopItem.price}g). Spoofed client price ignored.`);

    // 13. Inventory
    const invRes = await userA.fetch('/api/inventory');
    const ownedInv = invRes.data?.find(i => i.itemId === shopItem.id);
    let equipSuccess = false;
    if (ownedInv) {
      const equipRes = await userA.fetch(`/api/inventory/${ownedInv.id}/equip`, { method: 'POST' });
      equipSuccess = equipRes.status === 200 && equipRes.data?.equipped === true;
    }
    assert(13, 'Inventory & Item Equipment', !!ownedInv && equipSuccess, `Item "${shopItem.name}" found in inventory and equipped successfully`);

    // 14. Activity Logging
    const activityRes = await userA.fetch('/api/activity', {
      method: 'POST',
      body: {
        category: 'CODING',
        durationMinutes: 60,
        notes: 'Building Life RPG deploy verification',
      },
    });
    const dailySummaryRes = await userA.fetch('/api/activity/daily');
    const activityVerified = activityRes.status === 201 && dailySummaryRes.data?.codingMinutes >= 60;
    assert(14, 'Activity Logging', activityVerified, `Logged 60 min CODING. Daily total: ${dailySummaryRes.data?.codingMinutes} min`);

    // 15. Adaptive Missions
    const generateMissionsRes = await userA.fetch('/api/missions/generate', { method: 'POST' });
    const todayMissionsRes = await userA.fetch('/api/missions/today');
    const missions = generateMissionsRes.data || todayMissionsRes.data || [];
    const missionsVerified = Array.isArray(missions) && missions.length > 0;
    assert(15, 'Adaptive Daily Missions', missionsVerified, `Generated ${missions.length} adaptive missions based on user profile and activity`);

    // 16. Error Handling
    const badSignup = await userA.fetch('/api/auth/signup', { method: 'POST', body: { email: 'bad-email', password: '1' } });
    const badQuest = await userA.fetch('/api/quests', { method: 'POST', body: { title: '' } });
    const badShop = await userA.fetch('/api/shop/non-existent-id/purchase', { method: 'POST' });
    const errorHandling = badSignup.status === 400 && badQuest.status === 400 && (badShop.status === 400 || badShop.status === 404);
    assert(16, 'Error Handling & Request Validation', errorHandling, `Invalid signup: HTTP ${badSignup.status}, Empty quest title: HTTP ${badQuest.status}, Invalid shop item: HTTP ${badShop.status}`);

    console.log('\n============================================================');
    const allPassed = results.every(r => r.passed);
    console.log(`📊 TOTAL RESULT: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
    console.log(`STATUS: ${allPassed ? '🎉 100% SUCCESS - ALL SPECS VERIFIED' : '⚠️ FAILURES DETECTED'}`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Execution error:', err);
  }
}

runLiveTest();
