// ============================================================
// Life Quest — Header Auth & Session Verification Test
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

const PORT = 5098;
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

    // Test 1: Static assets
    console.log('\n--- Test 1: Static Assets ---');
    const jsRes = await request('GET', '/js/components/headerAuth.js');
    console.log(`GET /js/components/headerAuth.js -> Status ${jsRes.status}`);
    if (jsRes.status !== 200 || !jsRes.raw.includes('HeaderAuth')) {
      throw new Error('headerAuth.js not served correctly');
    }
    console.log('✓ headerAuth.js served with status 200 and valid JS content');

    const indexRes = await request('GET', '/');
    if (!indexRes.raw.includes('id="nav-auth-slot"') || !indexRes.raw.includes('headerAuth.js')) {
      throw new Error('index.html does not contain nav-auth-slot or headerAuth.js');
    }
    console.log('✓ index.html contains nav-auth-slot and loads headerAuth.js');

    // Test 2: Unauthenticated GET /api/auth/me
    console.log('\n--- Test 2: Unauthenticated /api/auth/me ---');
    const unauthRes = await request('GET', '/api/auth/me');
    console.log(`GET /api/auth/me (no cookie) -> Status ${unauthRes.status}`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/auth/me, got ${unauthRes.status}`);
    }
    console.log('✓ Unauthenticated request correctly returns 401');

    // Test 3: Authenticated Session with Profile
    console.log('\n--- Test 3: User Signup & Profile Creation ---');
    const unique = Date.now();
    const email = `cloud_${unique}@test.dev`;
    const password = 'TestPassword123!';

    const signupRes = await request('POST', '/api/auth/signup', {
      email,
      password,
      confirmPassword: password,
      username: `Cloud_${unique.toString().slice(-4)}`,
    });
    console.log(`POST /api/auth/signup -> Status ${signupRes.status}`);
    if (signupRes.status !== 201) {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
    }

    // Capture session cookie
    const setCookie = signupRes.headers['set-cookie'];
    if (!setCookie) throw new Error('No Set-Cookie returned from signup');
    const cookie = setCookie[0].split(';')[0];
    console.log('✓ Session cookie received');

    // Fetch /api/auth/me before profile creation (needsProfile = true)
    console.log('\n--- Test 4A: Authenticated /api/auth/me before character creation ---');
    const meBeforeProfile = await request('GET', '/api/auth/me', null, { Cookie: cookie });
    console.log(`GET /api/auth/me -> Status ${meBeforeProfile.status}, needsProfile: ${meBeforeProfile.body.needsProfile}`);
    if (meBeforeProfile.status !== 200 || !meBeforeProfile.body.needsProfile) {
      throw new Error('Expected needsProfile: true before character creation');
    }
    console.log('✓ Correctly identified user needing character profile creation');

    // Create character profile
    console.log('\n--- Test 4B: Create Character Profile ---');
    const charName = `Cloud_${unique.toString().slice(-4)}`;
    const createProfileRes = await request('POST', '/api/profile/create', {
      username: charName,
      avatar: 'warrior',
      class: 'WARRIOR',
      goals: ['FITNESS', 'CODING'],
    }, { Cookie: cookie });
    console.log(`POST /api/profile/create -> Status ${createProfileRes.status}`);
    if (createProfileRes.status !== 201) {
      throw new Error(`Profile creation failed: ${JSON.stringify(createProfileRes.body)}`);
    }

    // Fetch /api/auth/me with cookie
    console.log('\n--- Test 4C: Authenticated /api/auth/me with Character Data ---');
    const meRes = await request('GET', '/api/auth/me', null, { Cookie: cookie });
    console.log(`GET /api/auth/me -> Status ${meRes.status}`);
    if (meRes.status !== 200) {
      throw new Error(`Expected 200, got ${meRes.status}: ${JSON.stringify(meRes.body)}`);
    }

    if (!meRes.body.profile) {
      throw new Error('Missing profile in /api/auth/me');
    }
    if (!meRes.body.character) {
      throw new Error('Missing character in /api/auth/me');
    }

    console.log('✓ User profile returned:', {
      username: meRes.body.profile.username,
      level: meRes.body.profile.level,
      class: meRes.body.profile.class,
      gold: meRes.body.profile.gold,
    });
    console.log('✓ Character summary returned:', meRes.body.character);

    if (
      typeof meRes.body.character.name !== 'string' ||
      typeof meRes.body.character.level !== 'number' ||
      typeof meRes.body.character.gold !== 'number'
    ) {
      throw new Error('Character fields invalid in /api/auth/me');
    }

    // Test 5: Logout Flow & Cookie Invalidation
    console.log('\n--- Test 5: Logout & Session Invalidation ---');
    const logoutRes = await request('POST', '/api/auth/logout', null, { Cookie: cookie });
    console.log(`POST /api/auth/logout -> Status ${logoutRes.status}`);
    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes.body)}`);
    }

    // Confirm session is destroyed on server
    const postLogoutMe = await request('GET', '/api/auth/me', null, { Cookie: cookie });
    console.log(`GET /api/auth/me (after logout) -> Status ${postLogoutMe.status}`);
    if (postLogoutMe.status !== 401) {
      throw new Error(`Expected 401 after logout, got ${postLogoutMe.status}`);
    }
    console.log('✓ Server session destroyed and subsequent request returned 401');

    // Test 6: Idempotent Logout (unauthenticated)
    console.log('\n--- Test 6: Idempotent Logout ---');
    const idleLogout = await request('POST', '/api/auth/logout');
    console.log(`POST /api/auth/logout (no session) -> Status ${idleLogout.status}`);
    if (idleLogout.status !== 200) {
      throw new Error(`Expected 200 on idempotent logout, got ${idleLogout.status}`);
    }
    console.log('✓ Idempotent logout succeeds with 200');

    console.log('\n====================================================');
    console.log('🎉 ALL HEADER AUTH VERIFICATIONS PASSED SUCCESSFULLY');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit();
  }
})();
