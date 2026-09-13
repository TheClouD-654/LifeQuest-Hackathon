/**
 * TEMP verification: custom avatar save → reload persistence, against live server.
 * Creates a throwaway user, saves a small base64 avatar, re-fetches, then cleans up.
 */
require('dotenv').config();
const BASE_URL = 'http://localhost:5000';

class SessionClient {
  constructor() { this.cookies = ''; }
  async fetch(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(this.cookies ? { Cookie: this.cookies } : {}) };
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookies = setCookie.split(';')[0];
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
}

(async () => {
  const ts = Date.now();
  const c = new SessionClient();
  let userId = null;

  try {
    // 1. Signup
    const email = `avatar_test_${ts}@lifequest.dev`;
    const signup = await c.fetch('/api/auth/signup', {
      method: 'POST',
      body: { email, password: 'TestPassword123!', confirmPassword: 'TestPassword123!' },
    });
    userId = signup.data?.user?.id;
    console.log(`1. signup: ${signup.status} (user ${userId ? 'created' : 'MISSING'})`);
    if (signup.status !== 201) throw new Error('signup failed: ' + JSON.stringify(signup.data));

    // 2. Create character
    const create = await c.fetch('/api/profile/create', {
      method: 'POST',
      body: { username: `AvatarT${String(ts).slice(-6)}`, avatar: 'warrior', class: 'SCHOLAR' },
    });
    console.log(`2. create profile: ${create.status}`, create.status !== 201 ? JSON.stringify(create.data) : '');
    if (create.status !== 201) throw new Error('profile create failed');

    // 3. Save a small custom avatar (1x1 transparent PNG data URL)
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const patch = await c.fetch('/api/profile', {
      method: 'PATCH',
      body: { avatar: tinyPng },
    });
    console.log(`3. PATCH avatar: ${patch.status}`, patch.status !== 200 ? JSON.stringify(patch.data).slice(0, 200) : '');

    // 4. Re-fetch profile — simulate a page refresh
    const refetch = await c.fetch('/api/profile', { method: 'GET' });
    const saved = refetch.data?.avatar;
    const persisted = saved === tinyPng;
    console.log(`4. re-fetch: ${refetch.status}, avatar persisted: ${persisted ? 'YES ✅' : 'NO ❌ (got: ' + String(saved).slice(0, 60) + ')'} `);

    if (persisted) {
      console.log('\n✅ AVATAR PERSISTENCE VERIFIED');
    } else {
      console.log('\n❌ AVATAR DID NOT PERSIST');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('TEST ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    // 5. Cleanup throwaway user
    if (userId) {
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.user.delete({ where: { id: userId } });
        await prisma.$disconnect();
        console.log('5. cleanup: throwaway user deleted');
      } catch (e) {
        console.log('5. cleanup failed (leftover test user id=' + userId + '):', e.message);
      }
    }
  }
})();
