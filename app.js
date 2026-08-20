/**
 * app.js - Main Application Entry Point
 * Refactored to use Store pattern and Bundled Firebase
 */

// Удаляем прямые импорты Firebase
// import { firebaseAvailable, firebaseAuth, firebaseDb, initFirebase } from './firebase-config.js';
// import {
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   updateProfile,
//   signOut,
//   onAuthStateChanged
// } from 'firebase/auth';
// import { doc, setDoc, getDoc } from 'firebase/firestore';

// import './style.css'; // Removed to prevent render-blocking
import { I18nManager } from './i18n.js';
import { store } from './store.js';
import {
  loadGameData,
  getGameData,
  selectWordsForRound,
  selectHardWords,
  generateOptionsForWord,
  updateWordProgress,
  getCategories,
  getCategoryStats,
  getProgressStats,
  getCorrectTranslation,
  getQuestionWord,
  setWordsIndex
} from './data.js';
import {
  saveProgress,
  loadProgress,
  loadProgressWrapper,
  storageGet,
  storageSet,
  setUserXP,
  getUserXP,
  addXP,
  resetProgress,
  exportProgress,
  importProgress
} from './storage.js';
import { initUI, renderCategoryButtons, wireCategorySearch, showNotification, getFocusableElements, trapFocus } from './ui.js';

// ==================== INP OPTIMIZATION UTILITIES ====================

/**
 * Yields control back to the browser, allowing it to process pending
 * user interactions and paint updates. Critical for reducing INP input delay
 * by breaking long tasks into smaller yielding chunks.
 *
 * Uses scheduler.yield() when available (Chrome 110+), falls back to
 * a microtask+setTimeout chain that ensures the browser gets a chance
 * to process input events between our work.
 */
export function yieldToMain() {
  if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
    return scheduler.yield();
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Schedule a callback during the browser's idle period.
 * Falls back to setTimeout if requestIdleCallback is unavailable.
 */
export function scheduleIdle(callback, options) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(callback, options);
  }
  return setTimeout(callback, 1);
}

/**
 * Cancel a callback scheduled with scheduleIdle.
 */
export function cancelIdle(id) {
  if (typeof cancelIdleCallback === 'function' && typeof id !== 'undefined') {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

// Локальные переменные для Firebase-сервисов и функций (заполняются лениво)
let firebaseAuth, firebaseDb;
let createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile;
let doc, setDoc, getDoc, serverTimestamp;

const DEV = import.meta.env.DEV;

/**
 * Lazy-init Firebase services on first use. The single auth-state listener
 * lives inside firebase-config.js and emits `pwh:authStateChanged`, which we
 * subscribe to once from init() below. No `window.*` globals here.
 */
async function initializeFirebaseServices() {
  const firebaseConfigModule = await import('./firebase-config.js');
  const initResult = await firebaseConfigModule.initFirebase();

  firebaseAuth = initResult.firebaseAuth || firebaseConfigModule.firebaseAuth;
  firebaseDb = initResult.firebaseDb || firebaseConfigModule.firebaseDb;

  const [authModule, firestoreModule] = await Promise.all([
    import('firebase/auth'),
    import('firebase/firestore')
  ]);
  createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
  signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
  updateProfile = authModule.updateProfile;
  doc = firestoreModule.doc;
  setDoc = firestoreModule.setDoc;
  getDoc = firestoreModule.getDoc;
  serverTimestamp = firestoreModule.serverTimestamp;

  return { firebaseAuth, firebaseDb };
}

/**
 * Handler for the single auth-state event dispatched by firebase-config.js.
 * Loads server progress on login, falls back to local progress on logout.
 */
async function handleAuthStateChanged(user) {
  if (DEV) console.log('[Auth] state changed:', user ? user.uid : 'null');
  store.setUser(user);

  // Ensure firestore helpers are loaded so we can pass them into loadProgress.
  if (!doc || !getDoc) {
    try { await initializeFirebaseServices(); } catch { /* offline */ }
  }

  if (user) {
    try {
      const progress = await loadProgress(firebaseDb, doc, getDoc);
      applyProgress(progress, true);
    } catch (error) {
      console.error('[Auth] Failed to load progress:', error);
    }
  } else {
    const localProgress = await loadProgressWrapper();
    applyProgress(localProgress, false);
  }
}

// ==================== AUDIO ENGINE ====================
const AudioEngine = {
  ctx: null,
  masterGain: null,
  volume: 0.7,
  lastHoverTime: 0,
  HOVER_THROTTLE_MS: 150, // Минимальный интервал между звуками hover (мс)
  // Set to true only inside a qualifying user-gesture handler (click/keydown/touchstart).
  // Browser autoplay policy blocks AudioContext creation/resume until a real gesture,
  // and `mouseover` (used for hover sounds) does NOT count as one. Gating playback on
  // this flag prevents the "AudioContext was not allowed to start" warning.
  audioUnlocked: false,

  init() {
    const isMuted = storageGet('pixelWordHunter_muted') === 'true';
    store.setState({ audioEnabled: !isMuted });

    this.volume = parseFloat(storageGet('pixelWordHunter_volume')) || 0.7;
    return true;
  },

  /**
   * Called ONLY from a user-gesture listener (click/keydown/touchstart).
   * Creates and resumes the AudioContext while a gesture is active, which the
   * autoplay policy allows, then permits subsequent playback.
   */
  unlock() {
    this.audioUnlocked = true;
    this.ensureContext();
  },

  updateGain() {
    if (this.masterGain && this.ctx) {
      const isMuted = !store.getState().audioEnabled;
      this.masterGain.gain.setValueAtTime(isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  },

  ensureContext() {
    // Never create/resume the AudioContext before a user gesture has unlocked audio.
    // This guards against indirect callers (e.g. focus/automation) that could trip
    // the browser's autoplay policy.
    if (!this.audioUnlocked) return false;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.updateGain();
      } catch (e) {
        console.warn('[AudioEngine] Failed to create AudioContext:', e.message);
        return false;
      }
    }
    // Resume context only after user gesture (handled by unlock() in init).
    // Avoid calling resume() if state is already running or if no gesture occurred.
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        /* Silent fail until next interaction */
      });
    }
    return true;
  },

  playTone(steps = []) {
    // Bail out before touching the AudioContext until audio is unlocked by a gesture.
    if (!this.audioUnlocked) return;
    if (!store.getState().audioEnabled || steps.length === 0) return;
    if (!this.ensureContext()) return;
    const startAt = this.ctx.currentTime;

    steps.forEach(step => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = step.type || 'square';
      osc.frequency.setValueAtTime(step.freq, startAt + step.time);

      if (step.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(step.slideTo, startAt + step.time + step.duration);
      }

      gain.connect(this.masterGain);
      osc.connect(gain);

      gain.gain.setValueAtTime(0.0001, startAt + step.time);
      gain.gain.linearRampToValueAtTime(step.volume || 0.2, startAt + step.time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + step.time + step.duration);

      osc.start(startAt + step.time);
      osc.stop(startAt + step.time + step.duration);
    });
  },

  playCorrect() {
    this.playTone([
      { time: 0, freq: 659, duration: 0.1, volume: 0.2 },
      { time: 0.1, freq: 880, duration: 0.2, volume: 0.2 }
    ]);
  },

  playWrong() {
    this.playTone([
      { time: 0, freq: 220, duration: 0.1, volume: 0.2 },
      { time: 0.1, freq: 110, duration: 0.2, volume: 0.2 }
    ]);
  },

  playTransition() {
    this.playTone([{ time: 0, freq: 440, duration: 0.05, volume: 0.1 }]);
  },

  playHover() {
    const now = Date.now();
    if (now - this.lastHoverTime < this.HOVER_THROTTLE_MS) return;
    this.lastHoverTime = now;
    this.playTone([{ time: 0, freq: 150, duration: 0.05, volume: 0.05, type: 'sine' }]);
  }
};

// ==================== THEME MANAGER ====================
const ThemeManager = {
  apply(theme) {
    store.setTheme(theme);
    storageSet('pixelWordHunter_theme', theme);
  }
};

// ==================== AUTH MANAGER ====================
const AuthManager = {
  async register(username, email, password) {
    // Ensure Firebase services are initialized
    if (!firebaseAuth || !firebaseDb) {
      if (import.meta.env.DEV) console.log('[Auth] Initializing Firebase services for registration...');
      await initializeFirebaseServices();
      // Small delay to ensure Firebase is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!firebaseAuth) return { success: false, error: 'Firebase Auth failed to load.' };
    }
    try {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(user, { displayName: username });
      if (firebaseDb) {
        await setDoc(doc(firebaseDb, 'users', user.uid), {
          username, email, xp: 0, createdAt: new Date()
        });
      }
      // Track auth method to prevent auto anonymous sign-in
      localStorage.setItem('pixelWordHunter_authMethod', 'email');
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  },

  async login(email, password) {
    // Ensure Firebase services are initialized
    if (!firebaseAuth) {
      if (import.meta.env.DEV) console.log('[Auth] Initializing Firebase services for login...');
      await initializeFirebaseServices();
      // Small delay to ensure Firebase Auth is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!firebaseAuth) return { success: false, error: 'Firebase Auth failed to load.' };
    }
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // Track auth method to prevent auto anonymous sign-in
      localStorage.setItem('pixelWordHunter_authMethod', 'email');
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  },

  async logout() {
    const mod = await import('./firebase-config.js');
    await mod.logoutUser();
  },

  async tryAnonymous() {
    const mod = await import('./firebase-config.js');
    return mod.signInAnonymouslyOnce();
  }
};

// ==================== APP LOGIC ====================
let ui = null;

async function init() {
  try {
    ui = initUI();
    AudioEngine.init();
    // initializeFirebaseServices() будет вызвана только при необходимости
    // await initializeFirebaseServices(); // Убрали отсюда, чтобы загрузка была ленивой
    await I18nManager.init();

    // Yield to let the browser paint the initial UI and process any
    // pending user interactions before we start heavy data loading.
    await yieldToMain();

    // Unlock audio on first qualifying user gesture (click/keydown/touchstart).
    // mouseover/mousemove do NOT count as gestures for the autoplay policy, so we
    // gate ALL playback on the flag set here.
    const unlockAudio = () => {
      AudioEngine.unlock();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    // Load Data
    await loadGameData();

    // Yield between data loading and progress loading to keep main thread responsive
    await yieldToMain();

    const progress = await loadProgressWrapper();
    applyProgress(progress);

    // Yield after progress before UI setup
    await yieldToMain();

    // Initial UI state
    const theme = storageGet('pixelWordHunter_theme') || 'cyberpunk';
    ThemeManager.apply(theme);

    const categories = ['All', ...getCategories()];
    renderCategoryButtons(categories, (cat) => startGame(cat), getCategoryStats());
    wireCategorySearch('category-search', 'category-list');

    // Event Listeners
    setupEventListeners();

    // App state listener for UI reactivity
    store.addEventListener('stateChange', (e) => {
      const { state, changedKeys } = e.detail;
      if (changedKeys.includes('audioEnabled')) {
        AudioEngine.updateGain();
        storageSet('pixelWordHunter_muted', String(!state.audioEnabled));
      }
      if (changedKeys.includes('theme')) {
        storageSet('pixelWordHunter_theme', state.theme);
      }
      updateUI(state);
    });

    toggleScreen('menu');

    // Global auth event bridge — the ONE listener lives in firebase-config.js.
    window.addEventListener('pwh:authStateChanged', (e) => {
      handleAuthStateChanged(e.detail?.user || null);
    });

    // Update daily streak on app open.
    updateDailyStreak();

    // Handle PWA shortcut URLs (?action=quick|hard)
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    if (action === 'quick') {
      // Start an "All" mixed round immediately
      requestAnimationFrame(() => startGame('All'));
    } else if (action === 'hard') {
      requestAnimationFrame(() => startHardWords());
    }

    // Fallback: Ensure at least one screen is visible after a short delay
    setTimeout(() => {
      const visibleScreen = document.querySelector('.game-container:not(.hidden)');
      if (!visibleScreen) {
        if (DEV) console.warn('[App] No screen visible, forcing menu screen');
        toggleScreen('menu');
      }
    }, 500);

    // Preload Firebase modules during idle time so they're ready
    // when the user clicks LOGIN/REGISTER, avoiding long import()
    // tasks during the interaction itself.
    if (localStorage.getItem('pixelWordHunter_authMethod')) {
      scheduleIdle(() => {
        import('./firebase-config.js').then(m => m.initFirebase?.()).catch(() => {});
      }, { timeout: 3000 });
    }
  } catch (err) {
    console.error('[App] Initialization failed:', err);
    // Show load error message to user
    const loadErrorEl = document.getElementById('load-error');
    if (loadErrorEl) {
      loadErrorEl.textContent = `Initialization Error: ${err.message}. Please refresh the page.`;
      loadErrorEl.hidden = false;
      loadErrorEl.style.display = 'block';
      loadErrorEl.style.padding = '20px';
      loadErrorEl.style.color = 'var(--neon-pink)';
      loadErrorEl.style.textAlign = 'center';
    }
    // Still try to show the menu screen as a fallback
    toggleScreen('menu');
  }
}

function setupEventListeners() {
  // Navigation
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    AudioEngine.playTransition();
    toggleScreen('settings');
  });

  document.getElementById('settings-back-btn')?.addEventListener('click', () => toggleScreen('menu'));
  document.getElementById('category-back-btn')?.addEventListener('click', () => toggleScreen('menu'));
  document.getElementById('exit-game-btn')?.addEventListener('click', () => toggleScreen('menu'));

  // Auth
  document.getElementById('login-modal-btn')?.addEventListener('click', () => showAuthModal('login'));
  document.getElementById('register-modal-btn')?.addEventListener('click', () => showAuthModal('register'));
  document.getElementById('auth-close-btn')?.addEventListener('click', () => {
    closeAuthModal();
  });
  document.getElementById('auth-toggle-btn')?.addEventListener('click', () => {
    const mode = store.getState().authMode === 'login' ? 'register' : 'login';
    showAuthModal(mode);
  });

  document.getElementById('auth-submit')?.addEventListener('click', handleAuthSubmit);

  // Click outside the auth dialog closes it.
  document.getElementById('auth-modal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'auth-modal') closeAuthModal();
  });

  // Submit the auth form on Enter inside any of its inputs.
  document.getElementById('auth-form')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAuthSubmit();
    }
  });

  // Settings
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => ThemeManager.apply(btn.dataset.theme));
  });

  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await I18nManager.setLanguage(btn.dataset.lang);
      store.setState({ language: btn.dataset.lang });
    });
  });

  document.getElementById('settings-sound-btn')?.addEventListener('click', () => {
    store.toggleAudio();
  });

  document.getElementById('hunt-btn')?.addEventListener('click', () => toggleScreen('category'));
  document.getElementById('try-btn')?.addEventListener('click', async () => {
    AudioEngine.playTransition();
    // Explicit anonymous sign-in for guest mode. Falls back to offline play.
    AuthManager.tryAnonymous?.().catch(() => {});
    toggleScreen('category');
  });

  document.getElementById('hard-words-btn')?.addEventListener('click', () => {
    AudioEngine.playTransition();
    startHardWords();
  });

  document.getElementById('export-btn')?.addEventListener('click', exportProgress);
  document.getElementById('import-input')?.addEventListener('change', async (e) => {
    const result = await importProgress(e.target.files[0]);
    if (result?.success) {
      // Rehydrate in-memory data without a full page reload.
      applyProgress(result.progress || {}, false);
      renderCategoryButtons(['All', ...getCategories()], (cat) => startGame(cat), getCategoryStats());
      showNotification(I18nManager.t('import_success') || 'Import successful');
    } else if (result) {
      showNotification(I18nManager.t('import_invalid') || 'Invalid backup file');
    }
    e.target.value = ''; // allow re-importing the same file
  });

  document.getElementById('reset-progress-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog(I18nManager.t('reset_progress_confirm') || 'Reset all progress?');
    if (!ok) return;
    resetProgress();
    applyProgress({}, false);
    renderCategoryButtons(['All', ...getCategories()], (cat) => startGame(cat), getCategoryStats());
    showNotification(I18nManager.t('progress_reset') || 'Progress reset');
  });

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await AuthManager.logout();
    showNotification(I18nManager.t('logged_out') || 'Logged out successfully');
    // Reload to fully reset app state and show login buttons
    location.reload();
  });

  // Note: next-question-btn click is now handled within the game flow
  // to properly support Word Review sessions

  document.getElementById('next-question-btn')?.addEventListener('click', () => {
    nextQuestion();
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    const state = store.getState();
    const gameScreenActive = !ui.gameScreenElement.classList.contains('hidden');

    if (gameScreenActive) {
      if (!state.isAnswerLocked) {
        if (e.key >= '1' && e.key <= '4') {
          const index = parseInt(e.key) - 1;
          const options = ui.optionsElement.querySelectorAll('.option-btn');
          if (options[index]) options[index].click();
        }
      } else {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.getElementById('next-question-btn')?.click();
        }
      }
    }

    // Escape key to close modals
    if (e.key === 'Escape') {
      if (!ui.authModal.classList.contains('hidden')) {
        ui.authModal.classList.add('hidden');
      } else if (!ui.explanationModal.classList.contains('hidden')) {
        ui.explanationModal.classList.add('hidden');
      }
    }

    else if (!ui.menuScreenElement.classList.contains('hidden')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const huntBtn = document.getElementById('hunt-btn');
        const menuAction = huntBtn && !huntBtn.classList.contains('hidden')
          ? huntBtn
          : document.getElementById('try-btn');
        menuAction?.click();
      }
    }
  });

  // Global Hover Sound Effect
  document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('.option-btn, .category-btn, .theme-btn')) {
      AudioEngine.playHover();
    }
  });
}

let lastFocusedElement = null;
let releaseAuthTrap = null;

function showAuthModal(mode) {
  store.setState({ authMode: mode });
  ui.authTitle.textContent = mode === 'login' ? '// LOGIN //' : '// REGISTER //';
  
  const isLogin = mode === 'login';
  ui.usernameField.style.display = isLogin ? 'none' : 'flex';
  ui.usernameField.setAttribute('aria-hidden', isLogin ? 'true' : 'false');
  const usernameInput = document.getElementById('auth-username');
  if (isLogin) {
    usernameInput.setAttribute('tabindex', '-1');
  } else {
    usernameInput.removeAttribute('tabindex');
  }
  
  ui.authToggleText.textContent = isLogin ? 'Need an account?' : 'Have an account?';
  ui.authToggleBtn.textContent = isLogin ? 'REGISTER' : 'LOGIN';
  ui.authModal.classList.remove('hidden');
  ui.authModal.setAttribute('aria-hidden', 'false');
  
  lastFocusedElement = document.activeElement;
  
  // Yield to the browser first so it can paint the modal visible
  // before we do focus management. This reduces presentation delay
  // and ensures the visual update is seen before DOM focus moves.
  scheduleIdle(() => {
    const focusable = getFocusableElements(ui.authModal);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      ui.authModal.setAttribute('tabindex', '-1');
      ui.authModal.focus();
    }
    // Keep focus inside the auth modal.
    releaseAuthTrap = trapFocus(ui.authModal);
  }, { timeout: 100 });
}

async function handleAuthSubmit() {
  const mode = store.getState().authMode;
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value;

  ui.authSubmit.disabled = true;
  ui.authError.textContent = ''; // Clear previous errors
  let result;
  if (mode === 'register') {
    result = await AuthManager.register(username, email, password);
  } else {
    result = await AuthManager.login(email, password);
  }

  if (result.success) {
    closeAuthModal();
    showNotification('Success!');
  } else {
    ui.authError.textContent = result.error || 'Authentication failed';
  }
  ui.authSubmit.disabled = false;
}

function closeAuthModal() {
  ui.authModal.classList.add('hidden');
  ui.authModal.setAttribute('aria-hidden', 'true');
  ui.authError.textContent = '';

  if (releaseAuthTrap) { releaseAuthTrap(); releaseAuthTrap = null; }
  if (lastFocusedElement && document.body.contains(lastFocusedElement)) {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

function toggleScreen(screenId) {
  const screens = ['menu', 'settings', 'category', 'game'];
  screens.forEach(s => {
    const el = document.getElementById(`${s}-screen`);
    if (el) {
      const shouldBeHidden = s !== screenId;
      el.classList.toggle('hidden', shouldBeHidden);
      // Force display for the active screen to ensure visibility
      if (!shouldBeHidden) {
        el.style.display = 'flex';
      } else {
        el.style.display = '';
      }
    }
  });
}

function applyProgress(progressData, fromServer = false) {
  const words = getGameData();

  // Build a Map for O(1) lookups instead of O(n) Array.find()
  // Previously: Object.entries × words.find = O(n²) = 360,000 ops for 600 words
  // Now: Map build O(n) + Object.entries × Map.get = O(n) total
  const wordsByEng = new Map(words.map(w => [w.eng, w]));

  // Save the words-by-eng map on the module so updateWordProgress can reuse it
  // instead of O(n) .find() on every answer click.
  setWordsIndex(wordsByEng);

  Object.entries(progressData).forEach(([eng, data]) => {
    const word = wordsByEng.get(eng);
    if (word) Object.assign(word, data);
  });

  const stats = getProgressStats();

  // Server XP wins over local when we are hydrating from the server.
  const xpValue = fromServer && typeof progressData.__xp === 'number'
    ? progressData.__xp
    : getUserXP();

  store.setState({
    xp: xpValue,
    masteredCount: stats.mastered,
    learningCount: stats.learning,
    reviewCount: stats.newWords
  });

  if (import.meta.env.DEV) {
    if (import.meta.env.DEV) console.log(`[App] Progress applied: ${Object.keys(progressData).length} words, XP: ${xpValue}`);
  }
}

function updateUI(state = store.getState()) {
  if (!ui) return;

  // XP
  if (ui.xpElement) ui.xpElement.textContent = `${state.xp} XP`;
  if (ui.gameXpElement) ui.gameXpElement.textContent = `${state.xp} XP`;

  // Stats
  if (ui.masteredCountElement) ui.masteredCountElement.textContent = state.masteredCount;
  if (ui.streakElement) ui.streakElement.textContent = state.dailyStreak || 0;

  // Show identity in settings
  if (ui.settingsUserElement) {
    const u = state.user;
    if (u && (u.email || u.displayName)) {
      ui.settingsUserElement.textContent = `👤 ${u.displayName || u.email}`;
      ui.settingsUserElement.classList.remove('hidden');
    } else {
      ui.settingsUserElement.textContent = '';
      ui.settingsUserElement.classList.add('hidden');
    }
  }

  // Auth - Ensure UI matches actual authentication state
  const authButtons = document.getElementById('auth-buttons');
  const huntBtn = document.getElementById('hunt-btn');
  
  // Critical fix: Check localStorage token to prevent "ghost" authorization
  const hasToken = localStorage.getItem('pixelWordHunter_authMethod') !== null;
  const isActuallyAuthenticated = state.isAuthenticated && hasToken;
  
  if (isActuallyAuthenticated) {
    authButtons?.classList.add('hidden');
    huntBtn?.classList.remove('hidden');
  } else {
    authButtons?.classList.remove('hidden');
    huntBtn?.classList.add('hidden');
  }

  // Sound
  const soundIcon = document.getElementById('settings-sound-icon');
  const soundLabel = document.getElementById('settings-sound-label');
  if (soundIcon) soundIcon.textContent = state.audioEnabled ? '🔊' : '🔇';
  if (soundLabel) soundLabel.textContent = state.audioEnabled ? 'ON' : 'OFF';
}

// ==================== GAME FLOW ====================
const REVIEW_TRIGGER_ROUNDS = 3; // Show review after this many rounds

function startGame(category) {
  AudioEngine.playTransition();
  const roundWords = selectWordsForRound(category, 10);
  if (!roundWords.length) {
    showNotification(I18nManager.t('no_words') || 'No words available');
    return;
  }
  store.setState({
    currentCategory: category,
    currentRound: roundWords,
    currentQ: 0,
    roundScore: 0,
    wordStartTime: Date.now(),
    reviewSessionData: [], // Reset review data on new game
    completedRoundsCount: 0 // Reset counter on new game session
  });

  toggleScreen('game');
  loadQuestion();
}

/**
 * Start a review round consisting only of "hard" words (more wrong than right,
 * or seen-but-not-mastered). Falls back with a notification when empty.
 */
function startHardWords() {
  const hard = selectHardWords(10);
  if (!hard.length) {
    showNotification(I18nManager.t('no_hard_words') || 'No hard words yet — keep playing!');
    return;
  }
  store.setState({
    currentCategory: 'Hard',
    currentRound: hard,
    currentQ: 0,
    roundScore: 0,
    wordStartTime: Date.now(),
    reviewSessionData: [],
    completedRoundsCount: 0
  });
  toggleScreen('game');
  loadQuestion();
}

// ==================== DAILY STREAK ====================

function updateDailyStreak() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const last = storageGet('pwh_lastPlayed');
  let streak = parseInt(storageGet('pwh_streak'), 10) || 0;

  if (last === today) {
    // already counted today
  } else {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (last === y) {
      streak += 1;
    } else if (!last) {
      streak = 1;
    } else {
      streak = 1; // missed a day → reset
    }
    storageSet('pwh_lastPlayed', today);
    storageSet('pwh_streak', String(streak));
  }
  store.setState({ dailyStreak: streak });
}

// ==================== SPEECH SYNTHESIS ====================

const Speech = {
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  speak(text) {
    if (!this.supported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.95;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }
};

// ==================== CUSTOM CONFIRM MODAL ====================

/**
 * Themed replacement for window.confirm(). Uses a lightweight in-DOM modal
 * so it inherits the game aesthetic and stays inside the PWA shell.
 */
function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal confirm-modal';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="confirm-box">
        <p class="confirm-message"></p>
        <div class="confirm-actions">
          <button class="option-btn confirm-ok">${I18nManager.t('yes') || 'YES'}</button>
          <button class="option-btn confirm-cancel">${I18nManager.t('no') || 'NO'}</button>
        </div>
      </div>
    `;
    overlay.querySelector('.confirm-message').textContent = message;
    document.body.appendChild(overlay);
    const cleanup = (val) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.confirm-ok').addEventListener('click', () => cleanup(true));
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    overlay.querySelector('.confirm-ok').focus();
  });
}

function loadQuestion() {
  const { currentRound, currentQ, language } = store.getState();
  const word = currentRound[currentQ];
  const questionData = getQuestionWord(word, language);

  // Render the word with an optional speak button when the question is English.
  ui.wordElement.textContent = '';
  ui.wordElement.className = `lang-${language} typewriter`;
  const textSpan = document.createElement('span');
  textSpan.textContent = questionData.text;
  ui.wordElement.appendChild(textSpan);
  if (questionData.isEnglish && Speech.supported) {
    const speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'speak-btn';
    speakBtn.setAttribute('aria-label', 'Pronounce');
    speakBtn.textContent = '🔊';
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Speech.speak(questionData.text);
    });
    ui.wordElement.appendChild(speakBtn);
  }

  const options = generateOptionsForWord(word, language, questionData.isEnglish);
  ui.optionsElement.textContent = '';

  options.forEach((opt, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.setAttribute('aria-label', `Option ${index + 1}: ${opt}`);
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => checkAnswer(opt, word, btn, questionData.isEnglish));
    ui.optionsElement.appendChild(btn);
  });

  ui.explanationModal.classList.add('hidden');
  store.setState({ wordStartTime: Date.now(), isAnswerLocked: false });
}

function checkAnswer(selected, word, btn, questionIsEnglish) {
  const state = store.getState();
  if (state.isAnswerLocked) return;
  store.setState({ isAnswerLocked: true });

  const currentLang = store.getState().language;
  const isCorrect = selected === getCorrectTranslation(word, currentLang, questionIsEnglish);

  // Track word result for review session
  const wordResult = {
    word: word,
    isCorrect: isCorrect,
    questionIsEnglish: questionIsEnglish
  };

  if (isCorrect) {
    btn.classList.add('correct');
    btn.setAttribute('aria-pressed', 'true');
    AudioEngine.playCorrect();
    const bonus = 10; // Simple scoring
    // Use atomic XP increment for multi-tab synchronization
    addXP(bonus);
    updateWordProgress(word.eng, true);
  } else {
    btn.classList.add('wrong');
    btn.setAttribute('aria-pressed', 'false');
    AudioEngine.playWrong();
    updateWordProgress(word.eng, false);

    // Highlight correct
    const correctAnswer = getCorrectTranslation(word, currentLang, questionIsEnglish);
    Array.from(ui.optionsElement.children).forEach(b => {
      if (b.textContent === correctAnswer) {
        b.classList.add('correct');
        b.setAttribute('aria-pressed', 'true');
      }
    });
  }

  // Add to review session data (using store state)
  const currentState = store.getState();
  const updatedReviewData = [...currentState.reviewSessionData, wordResult];
  store.setState({ reviewSessionData: updatedReviewData });

  // Defer saveProgress to idle time to avoid blocking the main thread.
  // The local save (localStorage write) is the expensive part; Firebase
  // sync is already debounced inside saveProgress. By scheduling during
  // idle we let the browser process any pending user interactions first.
  scheduleIdle(() => {
    saveProgress(firebaseDb, doc, setDoc, serverTimestamp);
  });
  setTimeout(() => showExplanation(word, questionIsEnglish, false), 1000);
}

function showExplanation(word, questionIsEnglish, isReviewComplete = false) {
  const list = document.getElementById('explanation-list');
  const lang = store.getState().language;
  const nextBtn = document.getElementById('next-question-btn');

  // Ensure next button is visible (unless in review mode)
  if (!isReviewComplete) {
    nextBtn.style.display = 'inline-block';
  }

  list.textContent = '';
  list.setAttribute('role', 'list'); // Add role="list"

  const content = document.createElement('div');
  content.className = 'explanation-content';

  const wP = document.createElement('p');
  wP.className = 'explanation-word';
  wP.textContent = word.eng;

  const dP = document.createElement('p');
  dP.className = 'explanation-definition';
  dP.textContent = getCorrectTranslation(word, lang, questionIsEnglish);

  content.appendChild(wP);
  content.appendChild(dP);

  // Business Case Section
  if (word.exampleEng) {
    const exampleContainer = document.createElement('div');
    exampleContainer.className = 'explanation-example-container';

    const exEng = document.createElement('p');
    exEng.className = 'explanation-example-en';
    exEng.textContent = word.exampleEng;
    exampleContainer.appendChild(exEng);

    // Translated example fallback logic
    let translatedEx = '';
    let usedLang = 'ru';

    // Check if exampleKor is a valid translation (not a placeholder)
    const isValidKoreanExample = word.exampleKor &&
                                  word.exampleKor !== '미확인' &&
                                  !word.exampleKor.includes('실제 사용 사례');

    if (lang === 'ko' && isValidKoreanExample) {
      translatedEx = word.exampleKor;
      usedLang = 'ko';
    } else if (word.exampleRus) {
      translatedEx = word.exampleRus;
      usedLang = 'ru';
    } else if (word.exampleKor && word.exampleKor !== '미확인') {
      translatedEx = word.exampleKor;
      usedLang = 'ko';
    }

    if (translatedEx) {
      const exTrans = document.createElement('p');
      exTrans.className = `explanation-example-${usedLang}`;
      exTrans.textContent = translatedEx;
      exampleContainer.appendChild(exTrans);
    }

    content.appendChild(exampleContainer);
  }

  list.appendChild(content);

  ui.explanationModal.classList.remove('hidden');

  // Auto-pronounce the English word on the explanation screen so the learner
  // hears the correct pronunciation right after answering.
  if (word.eng) Speech.speak(word.eng);
}

function nextQuestion() {
  const state = store.getState();

  // Check if round is complete
  if (state.currentQ >= 9) {
    // Round complete - increment counter in store
    const newCount = state.completedRoundsCount + 1;
    store.setState({ completedRoundsCount: newCount });

    // Check if we should show review session
    if (newCount >= REVIEW_TRIGGER_ROUNDS && state.reviewSessionData.length > 0) {
      showReviewSession();
      return;
    }

    // Start new round — DO NOT reset completedRoundsCount here.
    // It must accumulate across rounds until Word Review actually fires
    // (which resets it via the continue button in showReviewSession).
    const roundWords = selectWordsForRound(state.currentCategory, 10);
    store.setState({
      currentRound: roundWords,
      currentQ: 0,
      roundScore: 0
    });
    loadQuestion();
  } else {
    store.setState({ currentQ: state.currentQ + 1 });
    loadQuestion();
  }
}

// Show Word Review session (Quizlet-style)
function showReviewSession() {
  const state = store.getState();
  const list = document.getElementById('explanation-list');
  const modalTitle = document.querySelector('#explanation-modal .modal-title');
  const nextBtn = document.getElementById('next-question-btn');

  // Change title to "WORD REVIEW"
  modalTitle.textContent = '// WORD REVIEW //';

  // Hide next button during review
  nextBtn.style.display = 'none';

  list.textContent = '';
  list.setAttribute('role', 'list'); // Ensure list role is set for the container

  if (state.reviewSessionData.length === 0) {
    // No words to review - show message
    const perfectMsg = document.createElement('p');
    perfectMsg.className = 'explanation-definition';
    perfectMsg.style.color = 'var(--neon-green)';
    perfectMsg.textContent = 'PERFECT! ALL WORDS CORRECT!';

    const listItem = document.createElement('div'); // Create a list item container
    listItem.setAttribute('role', 'listitem'); // Set role="listitem"
    listItem.appendChild(perfectMsg);
    list.appendChild(listItem);

  } else {
    // Create review cards for ALL words (both correct and incorrect)
    state.reviewSessionData.forEach((item) => {
      const card = document.createElement('div');
      card.setAttribute('role', 'listitem'); // Set role="listitem"
      const isCorrect = item.isCorrect;

      // Green card for correct, red for wrong
      card.className = `review-card ${isCorrect ? 'correct' : 'wrong'}`;

      const wordP = document.createElement('p');
      wordP.className = 'explanation-word';
      wordP.textContent = item.word.eng;

      const defP = document.createElement('p');
      defP.className = 'explanation-definition';
      defP.textContent = getCorrectTranslation(item.word, store.getState().language, item.questionIsEnglish);

      const statusP = document.createElement('p');
      statusP.className = 'review-status';
      statusP.textContent = isCorrect ? '✓ CORRECT' : '✗ NEEDS REVIEW';

      card.appendChild(wordP);
      card.appendChild(defP);
      card.appendChild(statusP);
      list.appendChild(card);
    });
  }

  // Add a "Continue" button to start new round
  const continueBtn = document.createElement('button');
  continueBtn.id = 'continue-after-review-btn';
  continueBtn.className = 'option-btn continue-after-review-btn';
  continueBtn.textContent = 'CONTINUE';
  continueBtn.setAttribute('aria-label', 'Continue to next round');
  continueBtn.addEventListener('click', () => {
    // Reset review data and start new round using store state
    store.setState({
      reviewSessionData: [],
      completedRoundsCount: 0
    });

    // Show next button again
    nextBtn.style.display = 'inline-block';

    // Start new round
    const state = store.getState();
    const roundWords = selectWordsForRound(state.currentCategory, 10);
    store.setState({
      currentRound: roundWords,
      currentQ: 0
    });
    loadQuestion();
  });
  list.appendChild(continueBtn);

  ui.explanationModal.classList.remove('hidden');
}

init();