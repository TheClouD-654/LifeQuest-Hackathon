// ============================================================
// Quest Completion Animation Orchestrator
// Sequences: card glow → XP popup → attribute flash → XP bar
// ============================================================

/**
 * Show reward popup at element position
 */
const showRewardPopup = (element, rewards) => {
  const rect = element.getBoundingClientRect();
  const popup = document.createElement('div');
  popup.className = 'reward-popup';
  popup.style.cssText = `
    left: ${rect.left + rect.width / 2}px;
    top: ${rect.top}px;
    transform: translateX(-50%);
  `;

  const lines = [
    `<div class="reward-popup-line xp">⚡ +${rewards.xp} XP</div>`,
    `<div class="reward-popup-line gold">🪙 +${rewards.gold} GOLD</div>`,
    ...Object.entries(rewards.attributes || {}).map(([attr, val]) =>
      `<div class="reward-popup-line attr">+${val} ${attr.toUpperCase()}</div>`
    ),
  ];

  popup.innerHTML = lines.join('');
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 2000);
};

/**
 * Full quest completion sequence
 */
const animateQuestComplete = async (questId, result) => {
  const card = document.getElementById(`quest-card-${questId}`);

  // 1. Card glow effect
  if (card) {
    card.classList.add('completing');
    card.style.borderColor = 'rgba(34, 197, 94, 0.5)';
    card.style.boxShadow = '0 0 30px rgba(34, 197, 94, 0.2)';

    // Show reward popup
    showRewardPopup(card, result.rewards);

    await new Promise(r => setTimeout(r, 500));

    // 2. Transform card to completed state
    const completeBtn = card.querySelector('.quest-complete-btn');
    if (completeBtn) {
      completeBtn.classList.add('completed-state');
      completeBtn.textContent = '✓ Done';
      completeBtn.disabled = true;
    }

    await new Promise(r => setTimeout(r, 300));
    card.classList.add('completed');
    card.classList.remove('completing');
  }

  await new Promise(r => setTimeout(r, 300));

  // 3. Update XP bar if on dashboard
  const xpFill = document.querySelector('.xp-bar-fill');
  const xpLabel = document.querySelector('.xp-bar-labels span:last-child');
  if (xpFill && result.character) {
    const { currentXp, xpRequired } = result.character;
    const pct = Math.min((currentXp / xpRequired) * 100, 100);
    xpFill.classList.add('animating');
    xpFill.style.width = `${pct}%`;
    setTimeout(() => xpFill.classList.remove('animating'), 3000);
    if (xpLabel) xpLabel.textContent = `${Utils.formatNumber(currentXp)} / ${Utils.formatNumber(xpRequired)} XP`;
  }

  // 4. Update gold display
  const goldEls = document.querySelectorAll('[data-gold]');
  if (result.character && goldEls.length > 0) {
    goldEls.forEach(el => {
      const prev = parseInt(el.textContent.replace(/,/g, '')) || 0;
      Utils.animateNumber(el, prev, result.character.gold);
    });
  }

  // 5. Update attribute displays
  if (result.attributes) {
    ['intellect', 'strength', 'discipline', 'vitality', 'focus', 'social'].forEach(attr => {
      const fill = document.querySelector(`.attr-fill.${attr}`);
      const val = document.querySelector(`[data-attr="${attr}"]`);
      if (fill && result.attributes[attr]) {
        const newVal = result.attributes[attr];
        const pct = Math.min((newVal / 200) * 100, 100);
        fill.style.width = `${pct}%`;
        if (val) val.textContent = newVal;
      }
    });
  }

  // 6. Level up celebration
  if (result.levelUp) {
    await new Promise(r => setTimeout(r, 600));
    showLevelUpOverlay(result.character.level, result.newTitle);
  }

  // 7. Achievement unlocks
  if (result.newAchievements && result.newAchievements.length > 0) {
    await new Promise(r => setTimeout(r, result.levelUp ? 3500 : 500));
    for (const ach of result.newAchievements) {
      showAchievementToast(ach);
      await new Promise(r => setTimeout(r, 800));
    }
  }
};

/**
 * Level-up overlay
 */
const showLevelUpOverlay = (level, newTitle) => {
  const overlay = document.createElement('div');
  overlay.className = 'level-up-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', `Level up! You are now level ${level}`);

  // Generate particles
  const particleColors = ['#ffd700', '#00d4ff', '#8b5cf6', '#22c55e'];
  const particlesHTML = Array.from({ length: 30 }, (_, i) => {
    const color = particleColors[i % particleColors.length];
    const angle = (i / 30) * Math.PI * 2;
    const distance = 150 + Math.random() * 200;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 100;
    const delay = Math.random() * 0.4;
    return `<div class="level-up-particle" style="
      background:${color};
      left:50%; top:50%;
      --tx:${tx}px; --ty:${ty}px;
      --duration:${0.8 + Math.random() * 0.8}s;
      --delay:${delay}s;
    "></div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="level-up-particles">${particlesHTML}</div>
    <div class="level-up-content">
      <div class="level-up-badge">⚡ Level Up! ⚡</div>
      <div class="level-up-number">${level}</div>
      <div class="level-up-title">${newTitle ? `"${newTitle}"` : 'Keep Going!'}</div>
      ${newTitle ? `<div class="level-up-unlocked">🎉 New Title: ${newTitle}</div>` : ''}
      <button class="btn btn-primary btn-lg" onclick="this.closest('.level-up-overlay').remove()" aria-label="Close level up dialog">
        Claim Reward
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Update level display in nav
  const levelEl = document.querySelector('.nav-level');
  if (levelEl) {
    levelEl.textContent = `LV ${level}`;
    levelEl.style.animation = 'pulse-glow 0.5s ease 3';
  }

  // Auto-close after 5 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.style.animation = 'overlay-fade-out 0.3s ease forwards';
      setTimeout(() => overlay.remove(), 300);
    }
  }, 5000);
};

/**
 * Achievement unlock toast
 */
const showAchievementToast = (achievement) => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span style="font-size:1.8rem">🏆</span>
    <div>
      <div style="font-size:0.7rem;color:var(--accent-gold);font-weight:700;letter-spacing:0.1em;text-transform:uppercase">Achievement Unlocked!</div>
      <div style="font-weight:700;color:var(--text-primary)">${achievement.name}</div>
      <div style="font-size:0.8rem;color:var(--text-secondary)">${achievement.description}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
};

window.QuestAnimation = { animateQuestComplete, showLevelUpOverlay, showAchievementToast };
