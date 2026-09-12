// ============================================================
// API Client — Centralized REST API communication
// All backend calls go through this module
// ============================================================

const BASE_URL = window.LIFE_RPG_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin
);

class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}

const request = async (method, path, body = null, signal = null) => {
  const options = {
    method,
    credentials: 'include', // Send session cookies
    headers: { 'Content-Type': 'application/json' },
    signal,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new APIError(data.error || `Request failed (${res.status})`, res.status);
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err instanceof APIError) throw err;
    if (!navigator.onLine) {
      document.body.classList.add('offline');
      throw new APIError('No internet connection. Please check your network.', 0);
    }
    throw new APIError(err.message || 'Network error', 0);
  }
};

// Restore online state
window.addEventListener('online', () => document.body.classList.remove('offline'));
window.addEventListener('offline', () => document.body.classList.add('offline'));

// ─── Auth ─────────────────────────────────────────────────────
const auth = {
  signup: (data) => request('POST', '/api/auth/signup', data),
  login:  (data) => request('POST', '/api/auth/login', data),
  logout: ()     => request('POST', '/api/auth/logout'),
  me:     ()     => request('GET',  '/api/auth/me'),
  googleUrl: () => `${BASE_URL}/api/auth/google`,
};

// ─── Profile ──────────────────────────────────────────────────
const profile = {
  get:    ()     => request('GET',   '/api/profile'),
  create: (data) => request('POST',  '/api/profile/create', data),
  update: (data) => request('PATCH', '/api/profile', data),
};

// ─── Attributes ───────────────────────────────────────────────
const attributes = {
  get: () => request('GET', '/api/attributes'),
};

// ─── Quests ───────────────────────────────────────────────────
const quests = {
  list:     (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/api/quests${q ? '?' + q : ''}`);
  },
  create:   (data) => request('POST',   '/api/quests', data),
  get:      (id)   => request('GET',    `/api/quests/${id}`),
  update:   (id, data) => request('PATCH', `/api/quests/${id}`, data),
  delete:   (id)   => request('DELETE', `/api/quests/${id}`),
  complete: (id)   => request('POST',   `/api/quests/${id}/complete`),
};

// ─── Activity ──────────────────────────────────────────────────
const activity = {
  list:    (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/api/activity${q ? '?' + q : ''}`);
  },
  log:     (data) => request('POST', '/api/activity', data),
  daily:   ()     => request('GET',  '/api/activity/daily'),
  summary: ()     => request('GET',  '/api/activity/summary'),
};

// ─── Missions ─────────────────────────────────────────────────
const missions = {
  today:    () => request('GET',  '/api/missions/today'),
  generate: () => request('POST', '/api/missions/generate'),
};

// ─── Shop ─────────────────────────────────────────────────────
const shop = {
  list:     () => request('GET',  '/api/shop'),
  purchase: (id) => request('POST', `/api/shop/${id}/purchase`),
};

// ─── Inventory ────────────────────────────────────────────────
const inventory = {
  list:    ()  => request('GET',  '/api/inventory'),
  equip:   (id) => request('POST', `/api/inventory/${id}/equip`),
  unequip: (id) => request('POST', `/api/inventory/${id}/unequip`),
};

// ─── Achievements ──────────────────────────────────────────────
const achievements = {
  list: () => request('GET', '/api/achievements'),
};

// ─── Stats ────────────────────────────────────────────────────
const stats = {
  get: () => request('GET', '/api/stats'),
};

// Export
window.API = {
  auth, profile, attributes, quests, activity,
  missions, shop, inventory, achievements, stats,
  APIError,
};
