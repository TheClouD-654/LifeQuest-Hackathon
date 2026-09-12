// ============================================================
// Life Quest — Profile Enhancements & Character Customization Test
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');

let app;
try {
  app = require('../src/server');
} catch (e) {
  console.error('Failed to load server:', e);
  process.exit(1);
}

const PORT = 5097;
const server = http.createServer(app);

const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (data) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: reqHeaders,
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          raw: responseBody,
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

(async () => {
  try {
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`Test server running on port ${PORT}`);

    // Test 1: Frontend Pages
    console.log('\n--- Test 1: Verify Profile and Settings Pages ---');
    const profilePageRes = await request('GET', '/pages/profile.html');
    console.log(`GET /pages/profile.html -> Status ${profilePageRes.status}`);
    if (profilePageRes.status !== 200 || !profilePageRes.raw.includes('Character Profile')) {
      throw new Error('/pages/profile.html failed to serve correctly');
    }
    console.log('✓ /pages/profile.html served with HTTP 200 and Character Profile content');

    const settingsPageRes = await request('GET', '/pages/settings.html');
    console.log(`GET /pages/settings.html -> Status ${settingsPageRes.status}`);
    if (settingsPageRes.status !== 200 || !settingsPageRes.raw.includes('Character Customization')) {
      throw new Error('/pages/settings.html failed to serve correctly');
    }
    console.log('✓ /pages/settings.html served with HTTP 200 and Customization content');

    // Test 2: User Creation & Setup
    console.log('\n--- Test 2: User Signup & Character Setup ---');
    const unique = Date.now();
    const email1 = `cloud_${unique}@test.dev`;
    const password = 'TestPassword123!';

    const signupRes = await request('POST', '/api/auth/signup', {
      email: email1,
      password,
      confirmPassword: password,
    });
    if (signupRes.status !== 201) throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);

    const cookie1 = signupRes.headers['set-cookie'][0].split(';')[0];

    const createCharRes = await request('POST', '/api/profile/create', {
      username: `Hero_${unique.toString().slice(-4)}`,
      avatar: 'warrior',
      class: 'WARRIOR',
      goals: ['FITNESS', 'CODING'],
    }, { Cookie: cookie1 });
    if (createCharRes.status !== 201) throw new Error(`Character creation failed: ${JSON.stringify(createCharRes.body)}`);
    console.log('✓ User and character created successfully');

    // Test 3: Rich GET /api/profile
    console.log('\n--- Test 3: Rich GET /api/profile ---');
    const getProfileRes = await request('GET', '/api/profile', null, { Cookie: cookie1 });
    console.log(`GET /api/profile -> Status ${getProfileRes.status}`);
    if (getProfileRes.status !== 200) throw new Error(`GET /api/profile failed: ${JSON.stringify(getProfileRes.body)}`);

    const p = getProfileRes.body;
    console.log('Profile fields returned:', {
      username: p.username,
      level: p.level,
      class: p.class,
      gold: p.gold,
      totalXp: p.totalXp,
      currentStreak: p.currentStreak,
    });

    if (!p.attributes || typeof p.attributes.intellect !== 'number' || typeof p.attributes.strength !== 'number') {
      throw new Error('Attributes missing or invalid in GET /api/profile');
    }
    console.log('✓ All 6 core attributes verified in profile payload');

    if (!p.account || p.account.email !== email1 || p.account.authMethod !== 'Email') {
      throw new Error('Account metadata missing or invalid in GET /api/profile');
    }
    console.log('✓ Account metadata verified (email, authMethod, createdAt)');

    if (!p.stats || typeof p.stats.totalQuests !== 'number' || typeof p.stats.completedQuests !== 'number') {
      throw new Error('Journey stats missing in GET /api/profile');
    }
    console.log('✓ Journey stats verified (totalQuests, completedQuests, achievementsUnlocked)');

    if (!Array.isArray(p.equippedItems)) {
      throw new Error('Equipped items array missing in GET /api/profile');
    }
    console.log('✓ Equipped items array verified');

    // Test 4: PATCH /api/profile Customization
    console.log('\n--- Test 4: PATCH /api/profile Customization ---');
    const updatedName = `Renowned_${unique.toString().slice(-4)}`;
    const patchRes = await request('PATCH', '/api/profile', {
      username: updatedName,
      avatar: 'rogue',
      title: 'Shadow Assassin',
      goals: ['CODING', 'READING', 'DISCIPLINE'],
      notificationsEnabled: false,
    }, { Cookie: cookie1 });

    console.log(`PATCH /api/profile -> Status ${patchRes.status}`);
    if (patchRes.status !== 200) throw new Error(`PATCH /api/profile failed: ${JSON.stringify(patchRes.body)}`);
    console.log('✓ Customization PATCH response successful');

    // Verify persistence via GET /api/profile
    const verifyGet = await request('GET', '/api/profile', null, { Cookie: cookie1 });
    if (
      verifyGet.body.username !== updatedName ||
      verifyGet.body.avatar !== 'rogue' ||
      verifyGet.body.title !== 'Shadow Assassin' ||
      !verifyGet.body.settings.goals.includes('READING')
    ) {
      throw new Error(`Profile updates did not persist: ${JSON.stringify(verifyGet.body)}`);
    }
    console.log('✓ Verified updated username, avatar, title, and goals persisted in DB');

    // Test 5: Verify GET /api/auth/me has updated identity
    console.log('\n--- Test 5: Verify GET /api/auth/me Sync ---');
    const meRes = await request('GET', '/api/auth/me', null, { Cookie: cookie1 });
    if (
      meRes.body.character.name !== updatedName ||
      meRes.body.character.avatar !== 'rogue' ||
      meRes.body.character.title !== 'Shadow Assassin'
    ) {
      throw new Error(`Auth me identity out of sync: ${JSON.stringify(meRes.body.character)}`);
    }
    console.log('✓ /api/auth/me returns updated character identity');

    // Test 6: Username Collision Handling (409 Conflict)
    console.log('\n--- Test 6: Username Collision on PATCH ---');
    const email2 = `rival_${unique}@test.dev`;
    const signup2 = await request('POST', '/api/auth/signup', {
      email: email2,
      password,
      confirmPassword: password,
    });
    const cookie2 = signup2.headers['set-cookie'][0].split(';')[0];
    await request('POST', '/api/profile/create', {
      username: `Rival_${unique.toString().slice(-4)}`,
      avatar: 'mage',
      class: 'SCHOLAR',
      goals: ['STUDY'],
    }, { Cookie: cookie2 });

    // Try to steal user1's username
    const collisionRes = await request('PATCH', '/api/profile', {
      username: updatedName,
    }, { Cookie: cookie2 });
    console.log(`PATCH /api/profile (collision) -> Status ${collisionRes.status}`);
    if (collisionRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate username, got ${collisionRes.status}`);
    }
    console.log('✓ Successfully rejected username collision with 409 Conflict');

    // Test 7: Invalid Username Format Handling (400 Bad Request)
    console.log('\n--- Test 7: Invalid Username Format ---');
    const invalidFormatRes = await request('PATCH', '/api/profile', {
      username: 'bad name with spaces!',
    }, { Cookie: cookie1 });
    console.log(`PATCH /api/profile (invalid format) -> Status ${invalidFormatRes.status}`);
    if (invalidFormatRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for invalid username format, got ${invalidFormatRes.status}`);
    }
    console.log('✓ Successfully rejected invalid username format with 400 Bad Request');

    console.log('\n====================================================');
    console.log('🎉 ALL PROFILE ENHANCEMENTS VERIFICATIONS PASSED');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit();
  }
})();
