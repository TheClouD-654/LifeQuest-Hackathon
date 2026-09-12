// ============================================================
// Utility Functions
// ============================================================

/**
 * Format minutes to human readable: 1h 30m
 */
const formatMinutes = (mins) => {
  if (!mins || mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * Format number with commas: 1240 → 1,240
 */
const formatNumber = (n) => (n || 0).toLocaleString();

/**
 * Animate a number counting up
 */
const animateNumber = (el, from, to, duration = 800, formatter = formatNumber) => {
  if (!el) return;
  const start = performance.now();
  const update = (time) => {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(from + (to - from) * ease);
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
};

/**
 * Show a toast notification
 */
const showToast = (message, type = 'info', duration = 4000) => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span style="font-size:1.2rem">${icons[type] || 'ℹ'}</span>
    <span style="flex:1;font-size:0.875rem">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

/**
 * Ripple effect on button click
 */
const addRipple = (btn) => {
  btn.addEventListener('click', (e) => {
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `
      width:${size}px; height:${size}px;
      left:${e.clientX - rect.left - size/2}px;
      top:${e.clientY - rect.top - size/2}px;
    `;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
};

/**
 * Debounce function
 */
const debounce = (fn, delay) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Format date to readable string
 */
const formatDate = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Get difficulty color class
 */
const getDifficultyClass = (diff) => (diff || '').toLowerCase();

/**
 * Get attribute icon
 */
const ATTR_ICONS = {
  intellect: '🧠', strength: '💪', discipline: '🎯',
  vitality: '❤️', focus: '⚡', social: '🤝',
};

/**
 * Redirect to login if not authenticated
 */
const requireAuthRedirect = async () => {
  try {
    const user = await API.auth.me();
    return user;
  } catch (err) {
    window.location.href = '/pages/auth.html';
    return null;
  }
};

/**
 * Check if user needs profile and redirect
 */
const checkProfileOrRedirect = async () => {
  const user = await requireAuthRedirect();
  if (!user) return null;
  if (user.needsProfile) {
    window.location.href = '/pages/character.html';
    return null;
  }
  return user;
};

/**
 * Build XP bar HTML
 */
const buildXPBar = (currentXp, xpRequired, level) => {
  const pct = xpRequired > 0 ? Math.min((currentXp / xpRequired) * 100, 100) : 0;
  return `
    <div class="xp-bar-container" role="progressbar" aria-valuemin="0" aria-valuemax="${xpRequired}" aria-valuenow="${currentXp}" aria-label="XP Progress">
      <div class="xp-bar-labels">
        <span class="text-cyan text-sm font-bold">LV${level}</span>
        <span class="text-secondary text-xs">${formatNumber(currentXp)} / ${formatNumber(xpRequired)} XP</span>
      </div>
      <div class="xp-bar-track">
        <div class="xp-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
};

/**
 * Build attribute bar HTML
 */
const buildAttributeBars = (attrs) => {
  const attrList = [
    { key: 'intellect',  label: 'INT', icon: '🧠' },
    { key: 'strength',   label: 'STR', icon: '💪' },
    { key: 'discipline', label: 'DIS', icon: '🎯' },
    { key: 'vitality',   label: 'VIT', icon: '❤️' },
    { key: 'focus',      label: 'FOC', icon: '⚡' },
    { key: 'social',     label: 'SOC', icon: '🤝' },
  ];

  return attrList.map(({ key, label, icon }) => {
    const val = attrs?.[key] || 0;
    const pct = Math.min((val / 200) * 100, 100); // Max display 200
    return `
      <div class="attr-bar-row">
        <span class="attr-name">${icon} ${label}</span>
        <div class="attr-track" role="progressbar" aria-valuemin="0" aria-valuemax="200" aria-valuenow="${val}" aria-label="${key} ${val}">
          <div class="attr-fill ${key}" style="width:${pct}%"></div>
        </div>
        <span class="attr-value">${val}</span>
      </div>
    `;
  }).join('');
};

/**
 * Build quest card HTML
 */
const buildQuestCard = (quest) => {
  const isCompleted = quest.status === 'COMPLETED' || quest.completions?.length > 0;
  const difficulty = (quest.difficulty || 'MEDIUM').toLowerCase();
  const isGenerated = quest.source === 'generated';

  const rewardChips = [
    `<span class="reward-chip xp">⚡ +${quest.xpReward} XP</span>`,
    `<span class="reward-chip gold">🪙 +${quest.goldReward} G</span>`,
    ...(quest.attributeRewards || []).map(ar =>
      `<span class="reward-chip attr">+${ar.value} ${ar.attribute.substring(0,3).toUpperCase()}</span>`
    ),
  ].join('');

  return `
    <div class="quest-card ${difficulty} ${isCompleted ? 'completed' : ''} ${isGenerated ? 'generated' : ''}"
         data-quest-id="${quest.id}" id="quest-card-${quest.id}">
      <div class="quest-card-header">
        <div style="display:flex;align-items:center;gap:8px;flex:1">
          <span class="quest-icon">⚔</span>
          <h3 class="quest-title">${quest.title}</h3>
        </div>
        <span class="diff-badge ${difficulty}">${quest.difficulty}</span>
      </div>
      <p class="quest-desc">${quest.description}</p>
      <div class="quest-rewards">${rewardChips}</div>
      ${!isCompleted ? `
        <div class="quest-card-actions">
          <button class="btn btn-complete btn-sm quest-complete-btn"
                  data-quest-id="${quest.id}"
                  aria-label="Complete quest: ${quest.title}">
            Complete
          </button>
          ${quest.source !== 'generated' ? `
            <button class="btn btn-ghost btn-sm quest-delete-btn"
                    data-quest-id="${quest.id}"
                    aria-label="Delete quest: ${quest.title}">
              🗑
            </button>
          ` : ''}
        </div>
      ` : `
        <div style="display:flex;align-items:center;gap:6px;color:var(--diff-easy);font-size:0.8rem;font-weight:600">
          <span class="quest-check-icon">✓</span> Completed
        </div>
      `}
    </div>
  `;
};

/**
 * Particles background
 */
const initParticles = (canvasId = 'particles-canvas') => {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.4 + 0.1,
  }));

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${p.alpha})`;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
    }
    requestAnimationFrame(draw);
  };

  draw();

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
};

/**
 * Update navbar character displays and sync RPG HUD
 */
const updateNavCharacter = (profile) => {
  if (!profile) return;
  const navLevel = document.getElementById('nav-level');
  if (navLevel) navLevel.textContent = `LV ${profile.level}`;
  const navGold = document.querySelector('#nav-gold [data-gold]');
  if (navGold) navGold.textContent = formatNumber(profile.gold);

  if (typeof HeaderAuth !== 'undefined' && HeaderAuth.syncUser) {
    HeaderAuth.syncUser({ profile });
  }
};

/**
 * Initialize navigation
 */
const initNav = (activePage = '') => {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
  }

  // Mark active page
  if (activePage) {
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.page === activePage) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  // Mount unified RPG HUD if nav-user-slot exists
  const userSlot = document.getElementById('nav-user-slot');
  if (userSlot && typeof HeaderAuth !== 'undefined') {
    const isPublic = ['leaderboard'].includes(activePage);
    HeaderAuth.init({ containerId: 'nav-user-slot', isAppNav: !isPublic });
  }
};

/**
 * Convert 2-letter ISO country code to flag emoji
 */
const countryToFlag = (code) => {
  if (!code || typeof code !== 'string' || code.trim().length !== 2) return '';
  const clean = code.trim().toUpperCase();
  const codePoints = [...clean].map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
};

/**
 * Global realm / countries list
 */
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'PL', name: 'Poland' },
  { code: 'SG', name: 'Singapore' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'RO', name: 'Romania' },
  { code: 'HU', name: 'Hungary' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'IL', name: 'Israel' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Peru' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'HK', name: 'Hong Kong' },
].map(c => ({ ...c, flag: countryToFlag(c.code) }));

/**
 * Populate a select element with countries
 */
const populateCountrySelect = (selectEl, selectedCode = '') => {
  if (!selectEl) return;
  selectEl.innerHTML = `
    <option value="">None / Hidden</option>
    ${COUNTRIES.map(c => `
      <option value="${c.code}" ${c.code === (selectedCode || '').toUpperCase() ? 'selected' : ''}>
        ${c.flag} ${c.name}
      </option>
    `).join('')}
  `;
};

// ─── Avatar rendering (built-in emoji ids + custom data-URL uploads) ──────────
// NOTE: named ..._MAP because several pages declare their own top-level
// `const AVATAR_EMOJIS` in inline scripts (shared global scope → collision).
const AVATAR_EMOJI_MAP = {
  scholar: '🧙', warrior: '⚔️', rogue: '🗡️', guardian: '🛡️',
  mage: '🔮', ranger: '🏹', paladin: '✨', assassin: '🌙',
};

/**
 * Custom avatars are stored as data URLs; built-ins are simple ids like 'warrior'.
 */
const isCustomAvatar = (avatar) => typeof avatar === 'string' && avatar.startsWith('data:image/');

const avatarEmoji = (avatar, fallback = '⚔') =>
  (avatar && !isCustomAvatar(avatar) && AVATAR_EMOJI_MAP[avatar]) || fallback;

/**
 * HTML string for an avatar — an <img> for custom uploads, the emoji otherwise.
 * `size` accepts any CSS length ('1em' scales with the surrounding font like an emoji would).
 */
const avatarHtml = (avatar, size = '1em', fallback = '⚔') => {
  if (isCustomAvatar(avatar)) {
    return `<img src="${avatar}" alt="" style="width:${size};height:${size};border-radius:50%;object-fit:cover;display:inline-block;vertical-align:middle">`;
  }
  return avatarEmoji(avatar, fallback);
};

/**
 * Paint an avatar into an existing element (circle divs etc.) in place.
 */
const setAvatar = (el, avatar, fallback = '🧙') => {
  if (!el) return;
  if (isCustomAvatar(avatar)) {
    el.innerHTML = `<img src="${avatar}" alt="Custom avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block">`;
  } else {
    el.textContent = avatarEmoji(avatar, fallback);
  }
};

// Expose globally
window.Utils = {
  formatMinutes, formatNumber, animateNumber,
  showToast, addRipple, debounce, formatDate,
  getDifficultyClass, ATTR_ICONS,
  requireAuthRedirect, checkProfileOrRedirect,
  buildXPBar, buildAttributeBars, buildQuestCard,
  initParticles, initNav, updateNavCharacter,
  countryToFlag, COUNTRIES, populateCountrySelect,
  isCustomAvatar, avatarEmoji, avatarHtml, setAvatar, AVATAR_EMOJI_MAP,
};
