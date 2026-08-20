/**
 * ui.js
 * UI initialization and common rendering functions
 */

/**
 * Returns an array of focusable elements within the given parent.
 * Used for accessibility and keyboard navigation management.
 * Exported for use in app.js and other modules.
 */
export function getFocusableElements(parent = document) {
  return Array.from(parent.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ));
}

export function initUI() {
  return {
    menuScreenElement: document.getElementById('menu-screen'),
    gameScreenElement: document.getElementById('game-screen'),
    wordElement: document.getElementById('word'),
    optionsElement: document.getElementById('options'),
    explanationModal: document.getElementById('explanation-modal'),
    xpElement: document.getElementById('menu-xp'),
    gameXpElement: document.getElementById('game-xp'),
    masteredCountElement: document.getElementById('mastered-count'),
    streakElement: document.getElementById('menu-streak'),
    settingsUserElement: document.getElementById('settings-user'),
    // Auth elements
    authModal: document.getElementById('auth-modal'),
    authTitle: document.getElementById('auth-title'),
    usernameField: document.getElementById('username-field'),
    authToggleText: document.getElementById('auth-toggle-text'),
    authToggleBtn: document.getElementById('auth-toggle-btn'),
    authError: document.getElementById('auth-error'),
    authSubmit: document.getElementById('auth-submit'),
  };
}

/**
 * Generate a consistent color for a category name
 */
function getCategoryColor(category) {
  if (category === 'All') return 'var(--neon-yellow)';
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 60%)`;
}

/**
 * Render category buttons safely using DocumentFragment. Each button shows a
 * mastered/total progress bar when `stats` are provided.
 *
 * @param {string[]} categories
 * @param {(category:string) => void} onSelect
 * @param {Record<string,{mastered:number,total:number}>} [stats]
 */
export function renderCategoryButtons(categories, onSelect, stats = {}) {
  const container = document.getElementById('category-list');
  if (!container) return;

  const fragment = document.createDocumentFragment();
  categories.forEach((category) => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', `${category} category`);
    btn.dataset.category = category.toLowerCase();

    const catColor = getCategoryColor(category);
    btn.style.setProperty('--cat-color', catColor);

    const nameEl = document.createElement('span');
    nameEl.className = 'category-name';
    nameEl.textContent = category;
    btn.appendChild(nameEl);

    // Optional progress bar
    const s = category === 'All'
      ? Object.values(stats).reduce(
          (acc, x) => ({ mastered: acc.mastered + x.mastered, total: acc.total + x.total }),
          { mastered: 0, total: 0 }
        )
      : stats[category];
    if (s && s.total > 0) {
      const pct = Math.round((s.mastered / s.total) * 100);
      const progressWrap = document.createElement('div');
      progressWrap.className = 'category-progress';
      const bar = document.createElement('div');
      bar.className = 'category-progress-fill';
      bar.style.width = pct + '%';
      progressWrap.appendChild(bar);
      const label = document.createElement('span');
      label.className = 'category-progress-label';
      label.textContent = `${s.mastered}/${s.total}`;
      btn.appendChild(progressWrap);
      btn.appendChild(label);
      btn.setAttribute('aria-label', `${category} category, ${s.mastered} of ${s.total} mastered`);
    }

    btn.addEventListener('click', () => onSelect(category));
    fragment.appendChild(btn);
  });

  container.textContent = '';
  container.appendChild(fragment);
}

/**
 * Attach a search input filter that hides/shows buttons in the container
 * based on their `data-category` attribute.
 */
export function wireCategorySearch(inputId, containerId) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    container.querySelectorAll('.category-btn').forEach(btn => {
      const name = btn.dataset.category || '';
      btn.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
  });
}

/**
 * Trap Tab/Shift+Tab inside `container` so keyboard users can't escape
 * an open modal. Returns a cleanup fn — call it when the modal closes.
 */
export function trapFocus(container) {
  if (!container) return () => {};
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const focusables = getFocusableElements(container).filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

/**
 * Show a simple notification
 */
export function showNotification(message, duration = 3000) {
  const el = document.getElementById('ios-notification');
  const textEl = document.getElementById('notification-text');
  if (!el || !textEl) return;

  textEl.textContent = message;
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('show'));
  
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 400);
  }, duration);
}