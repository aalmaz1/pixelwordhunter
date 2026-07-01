/**
 * ui.js
 * UI initialization and common rendering functions
 */

export function initUI() {
  return {
    onboardingScreenElement: document.getElementById('onboarding-screen'),
    menuScreenElement: document.getElementById('menu-screen'),
    settingsScreenElement: document.getElementById('settings-screen'),
    categoryScreenElement: document.getElementById('category-screen'),
    gameScreenElement: document.getElementById('game-screen'),
    wordElement: document.getElementById('word'),
    optionsElement: document.getElementById('options'),
    explanationModal: document.getElementById('explanation-modal'),
    xpElement: document.getElementById('menu-xp'),
    gameXpElement: document.getElementById('game-xp'),
    masteredCountElement: document.getElementById('mastered-count'),
    totalCountElement: document.getElementById('total-count'),
    feedbackElement: document.getElementById('feedback'),
    // Auth elements
    authModal: document.getElementById('auth-modal'),
    authTitle: document.getElementById('auth-title'),
    authForm: document.getElementById('auth-form'),
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
 * Render category buttons safely using DocumentFragment
 */
export function renderCategoryButtons(categories, onSelect) {
  const container = document.getElementById('category-list');
  if (!container) return;

  const fragment = document.createDocumentFragment();
  categories.forEach((category) => {
    const btn = document.createElement('button');
    btn.textContent = category;
    btn.className = 'category-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', `${category} category`); // Add aria-label
    
    // Dynamic CSS variable injection for category color
    const catColor = getCategoryColor(category);
    btn.style.setProperty('--cat-color', catColor);
    
    btn.addEventListener('click', () => onSelect(category));
    fragment.appendChild(btn);
  });

  container.textContent = ''; // Safe clear
  container.appendChild(fragment);
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