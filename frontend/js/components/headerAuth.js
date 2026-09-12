// ============================================================
// HeaderAuth Component — Life Quest
// Handles landing page and global header authentication state,
// RPG profile badge control, accessible dropdown, and logout.
// ============================================================

(() => {
  const AVATAR_EMOJIS = {
    scholar: '🧙',
    warrior: '⚔️',
    rogue: '🗡️',
    guardian: '🛡️',
    mage: '🔮',
    ranger: '🏹',
    paladin: '✨',
    assassin: '🌙',
  };

  const CLASS_LABELS = {
    SCHOLAR: '📚 Scholar',
    WARRIOR: '⚔️ Warrior',
    GUARDIAN: '🛡️ Guardian',
    ROGUE: '🗡️ Rogue',
  };

  let currentUser = null;
  let activeDropdown = null;
  let activeContainer = null;
  let isAppNavigation = false;

  /**
   * Render loading skeleton into the auth slot to prevent layout shift and auth flash
   */
  const renderSkeleton = (container) => {
    container.innerHTML = `<div class="nav-auth-skeleton" aria-hidden="true" title="Checking session..."></div>`;
  };

  /**
   * Render logged out state (Log In + Start Journey)
   */
  const renderLoggedOut = (container, heroCta) => {
    container.innerHTML = `
      <div class="nav-auth-buttons">
        <a href="/pages/auth.html?mode=login" class="btn btn-ghost btn-sm" id="nav-login-btn">Log In</a>
        <a href="/pages/auth.html?mode=signup" class="btn btn-primary btn-sm" id="nav-signup-btn">Start Journey</a>
      </div>
    `;

    if (heroCta) {
      heroCta.textContent = '⚔ Start Your Journey';
      heroCta.href = '/pages/auth.html?mode=signup';
    }
  };

  /**
   * Render authenticated RPG profile control and popover
   */
  const renderLoggedIn = (container, user, heroCta, isAppNav = false) => {
    const prof = user.profile || user.character || {};
    const hasProfile = !user.needsProfile && prof.username;

    const charName = hasProfile ? prof.username : 'New Adventurer';
    const charLevel = prof.level || 1;
    const charGold = typeof prof.gold === 'number' ? prof.gold : 100;
    const charAvatar = AVATAR_EMOJIS[prof.avatar] || '⚔';
    const charClass = CLASS_LABELS[prof.class] || prof.class || (hasProfile ? 'Novice' : 'Setup Pending');
    const charTitle = prof.title ? ` • "${prof.title}"` : '';

    const dashboardUrl = hasProfile ? '/pages/dashboard.html' : '/pages/character.html';
    const profileUrl = hasProfile ? '/pages/profile.html' : '/pages/character.html';

    const ctaButtonHtml = (!isAppNav && !hasProfile)
      ? `<a href="/pages/character.html" class="btn btn-primary btn-sm nav-dashboard-cta" id="nav-dashboard-link">Setup Character</a>`
      : (!isAppNav
        ? `<a href="${dashboardUrl}" class="btn btn-primary btn-sm nav-dashboard-cta" id="nav-dashboard-link">Dashboard</a>`
        : '');

    container.innerHTML = `
      ${ctaButtonHtml}
      <div class="nav-profile-control" id="nav-profile-control">
        <button class="nav-profile-trigger" id="nav-profile-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="nav-profile-dropdown"
                aria-label="Character Menu: ${charName}, Level ${charLevel}, ${charGold} Gold">
          <span class="nav-profile-badge name">
            <span class="avatar-ico">${charAvatar}</span>
            <span class="char-name">${charName}</span>
          </span>
          <span class="nav-profile-badge level">LV ${charLevel}</span>
          <span class="nav-profile-badge gold">
            <span class="gold-coin" aria-hidden="true"></span>
            <span class="char-gold">${typeof Utils !== 'undefined' && Utils.formatNumber ? Utils.formatNumber(charGold) : charGold} G</span>
          </span>
          <span class="nav-profile-chevron" aria-hidden="true">▾</span>
        </button>

        <div class="nav-profile-dropdown" id="nav-profile-dropdown" role="menu" aria-label="Player profile menu" hidden>
          <div class="nav-profile-dropdown-header">
            <div class="nav-profile-dropdown-avatar" aria-hidden="true">${charAvatar}</div>
            <div class="nav-profile-dropdown-info">
              <div class="nav-profile-dropdown-name">${charName}</div>
              <div class="nav-profile-dropdown-class">${charClass}${charTitle}</div>
            </div>
          </div>
          <div class="nav-profile-divider"></div>
          <a href="${profileUrl}" class="nav-profile-item" role="menuitem">
            <span class="item-icon">👤</span>
            <span class="item-text">Character Profile</span>
          </a>
          <a href="/pages/dashboard.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">📊</span>
            <span class="item-text">Status / Dashboard</span>
          </a>
          <a href="/pages/quests.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">⚔</span>
            <span class="item-text">Quests</span>
          </a>
          <a href="/pages/activity.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">📈</span>
            <span class="item-text">Activity</span>
          </a>
          <a href="/pages/stats.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">🏆</span>
            <span class="item-text">Stats</span>
          </a>
          <a href="/pages/leaderboard.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">🏅</span>
            <span class="item-text">Hall of Champions</span>
          </a>
          <a href="/pages/shop.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">🛡</span>
            <span class="item-text">Armory</span>
          </a>
          <a href="/pages/inventory.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">🎒</span>
            <span class="item-text">Inventory</span>
          </a>
          <a href="/pages/settings.html" class="nav-profile-item" role="menuitem">
            <span class="item-icon">⚙</span>
            <span class="item-text">Settings</span>
          </a>
          <div class="nav-profile-divider"></div>
          <button type="button" class="nav-profile-item logout" id="header-logout-btn" role="menuitem">
            <span class="item-icon">🚪</span>
            <span class="item-text">Log Out</span>
          </button>
        </div>
      </div>
    `;

    // Update Hero CTA if present
    if (heroCta) {
      heroCta.textContent = hasProfile ? '⚔ Go to Dashboard' : '⚔ Create Character';
      heroCta.href = dashboardUrl;
    }

    // Attach Dropdown Interactions
    const trigger = document.getElementById('nav-profile-trigger');
    const dropdown = document.getElementById('nav-profile-dropdown');
    const logoutBtn = document.getElementById('header-logout-btn');

    if (trigger && dropdown) {
      const openDropdown = () => {
        dropdown.removeAttribute('hidden');
        trigger.setAttribute('aria-expanded', 'true');
        activeDropdown = dropdown;
      };

      const closeDropdown = () => {
        dropdown.setAttribute('hidden', '');
        trigger.setAttribute('aria-expanded', 'false');
        activeDropdown = null;
      };

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          closeDropdown();
        } else {
          openDropdown();
        }
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          closeDropdown();
        }
      });

      // Close on ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeDropdown) {
          closeDropdown();
          if (typeof trigger.focus === 'function') trigger.focus();
        }
      });
    }

    // Attach Logout Click Handler
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        logoutBtn.disabled = true;
        const textSpan = logoutBtn.querySelector('.item-text');
        if (textSpan) textSpan.textContent = 'Logging out...';

        try {
          if (typeof API !== 'undefined' && API.auth && API.auth.logout) {
            await API.auth.logout();
          }
        } catch (err) {
          console.warn('Logout request completed with notice:', err);
        } finally {
          currentUser = null;
          if (isAppNav) {
            window.location.href = '/';
          } else {
            renderLoggedOut(container, heroCta);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
              Utils.showToast('Logged out successfully', 'info');
            }
          }
        }
      });
    }
  };

  /**
   * Main initializer: checks server session without localStorage assumption
   */
  const init = async (options = {}) => {
    const containerId = options.containerId || 'nav-auth-slot';
    const heroCtaId = options.heroCtaId || 'hero-cta-start';
    isAppNavigation = !!options.isAppNav;

    const container = document.getElementById(containerId);
    if (!container) return null;

    activeContainer = container;
    const heroCta = document.getElementById(heroCtaId);

    // Render initial skeleton placeholder if empty
    if (!container.firstElementChild) {
      renderSkeleton(container);
    }

    try {
      if (typeof API === 'undefined' || !API.auth || !API.auth.me) {
        renderLoggedOut(container, heroCta);
        return null;
      }

      // Query existing server session
      const user = await API.auth.me();

      if (user && user.id) {
        currentUser = user;
        renderLoggedIn(container, user, heroCta, isAppNavigation);
        return user;
      } else {
        currentUser = null;
        renderLoggedOut(container, heroCta);
        return null;
      }
    } catch (err) {
      currentUser = null;
      if (isAppNavigation) {
        // App page requires authentication
        window.location.href = '/pages/auth.html';
      } else {
        renderLoggedOut(container, heroCta);
      }
      return null;
    }
  };

  /**
   * Synchronize local character identity immediately when updated in settings or profile
   */
  const syncUser = (updatedData = {}) => {
    if (!currentUser) return;
    if (updatedData.profile) {
      currentUser.profile = { ...currentUser.profile, ...updatedData.profile };
      if (currentUser.character) {
        currentUser.character = { ...currentUser.character, ...updatedData.profile };
      }
    } else {
      currentUser.profile = { ...currentUser.profile, ...updatedData };
      if (currentUser.character) {
        currentUser.character = { ...currentUser.character, ...updatedData };
      }
    }

    if (activeContainer) {
      const heroCta = document.getElementById('hero-cta-start');
      renderLoggedIn(activeContainer, currentUser, heroCta, isAppNavigation);
    }
  };

  window.HeaderAuth = {
    init,
    syncUser,
    getCurrentUser: () => currentUser,
  };
})();
