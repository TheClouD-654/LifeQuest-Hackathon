// ============================================================
// Life Quest — Hall of Champions & Leaderboard Test Suite
// Verifies rankings, sorts, country support, privacy, and myRank
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

    const uid = Date.now().toString().slice(-6);
    const email = `lb_test_${uid}@example.com`;
    const password = 'Password123!';
    const username = `champ_${uid}`;

    console.log('\n--- 1. Testing User Signup & Character Creation with Country ---');
    const signupRes = await request('POST', '/api/auth/signup', { email, password, confirmPassword: password });
    console.log('Signup status:', signupRes.status);
    if (signupRes.status !== 201) throw new Error('Signup failed: ' + JSON.stringify(signupRes.body));

    const cookieHeader = signupRes.headers['set-cookie'];
    const sessionCookie = cookieHeader ? cookieHeader.map(c => c.split(';')[0]).join('; ') : '';
    const authHeaders = { Cookie: sessionCookie };

    const createRes = await request('POST', '/api/profile/create', {
      username,
      avatar: 'warrior',
      class: 'WARRIOR',
      goals: ['CODING', 'PRODUCTIVITY'],
      country: 'JP',
    }, authHeaders);
    console.log('Profile create status:', createRes.status);
    if (createRes.status !== 201) throw new Error('Profile create failed: ' + JSON.stringify(createRes.body));

    console.log('\n--- 2. Testing Public Leaderboard (Unauthenticated) ---');
    const pubRes = await request('GET', '/api/leaderboard');
    console.log('Public leaderboard status:', pubRes.status);
    if (pubRes.status !== 200) throw new Error('Public leaderboard failed: ' + JSON.stringify(pubRes.body));

    const { leaderboard, total, sort, myRank } = pubRes.body;
    console.log(`Total champions: ${total}, current sort: ${sort}, entries returned: ${leaderboard.length}`);
    if (!Array.isArray(leaderboard)) throw new Error('Leaderboard is not an array');
    if (myRank !== null) throw new Error('myRank should be null for unauthenticated requests');

    // Check data integrity & privacy (no passwords, emails, internal tokens)
    if (leaderboard.length > 0) {
      const top = leaderboard[0];
      console.log('Top entry sample:', JSON.stringify(top));
      if (top.email || top.password || top.googleId) {
        throw new Error('SECURITY LEAK: sensitive user data found in leaderboard!');
      }
      if (typeof top.rank !== 'number' || !top.username || typeof top.level !== 'number') {
        throw new Error('Invalid leaderboard entry schema');
      }
    }

    console.log('\n--- 3. Testing Leaderboard Sort Modes ---');
    for (const sortMode of ['level', 'xp', 'gold', 'streak']) {
      const sRes = await request('GET', `/api/leaderboard?sort=${sortMode}`);
      if (sRes.status !== 200) throw new Error(`Sort ${sortMode} failed`);
      console.log(`✓ Sort mode '${sortMode}' returned ${sRes.body.leaderboard.length} entries`);
    }

    console.log('\n--- 4. Testing Authenticated Leaderboard (with myRank) ---');
    const authLbRes = await request('GET', '/api/leaderboard', null, authHeaders);
    console.log('Auth leaderboard status:', authLbRes.status);
    if (authLbRes.status !== 200) throw new Error('Auth leaderboard failed');
    console.log('User myRank:', JSON.stringify(authLbRes.body.myRank));
    if (!authLbRes.body.myRank) throw new Error('Authenticated request should return myRank');
    if (authLbRes.body.myRank.username !== username) throw new Error('myRank username mismatch');
    if (authLbRes.body.myRank.country !== 'JP') throw new Error(`Expected country JP, got ${authLbRes.body.myRank.country}`);
    if (authLbRes.body.myRank.isMe !== true) throw new Error('isMe should be true');

    console.log('\n--- 5. Testing Profile Country Update via PATCH /api/profile ---');
    const patchRes = await request('PATCH', '/api/profile', {
      country: 'US',
      title: 'Grand Master',
    }, authHeaders);
    console.log('Patch status:', patchRes.status);
    if (patchRes.status !== 200) throw new Error('Patch profile failed');
    if (patchRes.body.country !== 'US') throw new Error(`Expected country US, got ${patchRes.body.country}`);

    console.log('\n--- 6. Verifying Updated Country on Leaderboard ---');
    const updatedLbRes = await request('GET', '/api/leaderboard', null, authHeaders);
    if (updatedLbRes.body.myRank.country !== 'US') throw new Error(`Expected updated country US, got ${updatedLbRes.body.myRank.country}`);
    console.log('✓ Country updated and reflected on leaderboard successfully:', updatedLbRes.body.myRank.country);

    console.log('\n========================================');
    console.log('🎉 ALL LEADERBOARD TESTS PASSED!');
    console.log('========================================\n');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification test error:', err);
    server.close();
    process.exit(1);
  }
})();
