/**
 * app.js — Main Application Entry Point
 * Boot, lazy Firebase glue, audio SFX, screens, quiz flow, account auth/deletion.
 */

import { I18nManager } from './i18n.js';
import { store } from './store.js';
import {
  loadGameData, getGameData, selectWordsForRound, selectHardWords, generateOptionsForWord,
  updateWordProgress, getCategories, getCategoryStats, getProgressStats, getCorrectTranslation,
  getQuestionWord, getWordTranslation, getExampleTranslation, setWordsIndex
} from './data.js';
import {
  saveProgress, loadProgress, loadProgressWrapper, storageGet, storageSet, getGuestProgress,
  getGuestXP, migrateAnonymousXP, clearGuestProgress, mergeProgress, persistCurrentProgress,
  getUserXP, addXP, flushPendingXP, syncXPToCloud, resetProgress, beginAccountDeletionSync,
  markAccountDeletionCloudRemovalStarted, abortAccountDeletionSync, sealAccountDeletionAfterCloudRemoval,
  finishAccountDeletionSync, waitForAccountCloudWrites, clearAccountData, exportProgress, importProgress
} from './storage.js';
import { initUI, renderCategoryButtons, wireCategorySearch, showNotification, getFocusableElements, trapFocus } from './ui.js';

// ==================== SMALL HELPERS ====================
const DEV = import.meta.env.DEV;
const $ = (id) => document.getElementById(id);
const t = (key) => I18nManager.t(key);
const on = (id, event, handler) => $(id)?.addEventListener(event, handler);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setTxt = (el, value) => { if (el) el.textContent = value; };
const mk = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

// ==================== INP OPTIMIZATION ====================
// Yield control to the browser between work chunks so pending input/paint can run.
// Uses scheduler.yield() (Chrome 110+) where available, else a setTimeout tick.
const yieldToMain = () => (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function')
  ? scheduler.yield() : wait(0);
const scheduleIdle = (callback, options) => typeof requestIdleCallback === 'function'
  ? requestIdleCallback(callback, options) : setTimeout(callback, 1);

// ==================== FIREBASE (lazy, no window.* globals) ====================
let firebaseAuth, firebaseDb;
let createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile;
let deleteUser, EmailAuthProvider, reauthenticateWithCredential;
let doc, setDoc, getDoc, writeBatch, serverTimestamp;

async function initializeFirebaseServices() {
  const configModule = await import('./firebase-config.js');
  const initResult = await configModule.initFirebase();
  firebaseAuth = initResult.firebaseAuth || configModule.firebaseAuth;
  firebaseDb = initResult.firebaseDb || configModule.firebaseDb;
  const [authModule, firestoreModule] = await Promise.all([
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  ({ createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
     updateProfile, deleteUser, EmailAuthProvider, reauthenticateWithCredential } = authModule);
  ({ doc, setDoc, getDoc, writeBatch, serverTimestamp } = firestoreModule);
  return { firebaseAuth, firebaseDb };
}

const syncProgress = () => saveProgress(firebaseDb, doc, setDoc, serverTimestamp);

/** Loads server progress on login, falls back to local progress on logout.
 *  The one auth-state listener lives in firebase-config.js and emits `pwh:authStateChanged`. */
async function handleAuthStateChanged(user) {
  if (DEV) console.log('[Auth] state changed:', user ? user.uid : 'null');
  store.setUser(user);
  if (!doc || !getDoc) { try { await initializeFirebaseServices(); } catch { /* offline */ } }

  if (user) {
    try {
      if (user.isAnonymous) migrateAnonymousXP(user.uid);
      let progress = await loadProgress(firebaseDb, doc, getDoc);
      const guestProgress = getGuestProgress();
      const guestXP = getGuestXP();
      const hasGuestData = Object.keys(guestProgress).length > 0 || guestXP > 0;
      if (!user.isAnonymous && hasGuestData && await confirmDialog(t('merge_guest_progress'))) {
        progress = mergeProgress(progress, guestProgress);
        persistCurrentProgress(progress);
        // addXP only targets non-anonymous accounts: this moves local guest XP
        // into the account's local bucket and its next batched Firestore increment.
        if (guestXP > 0) await addXP(guestXP);
        clearGuestProgress();
      }
      applyProgress(progress, true);
      if (Object.keys(progress).length) syncProgress();
    } catch (error) {
      console.error('[Auth] Failed to load progress:', error);
    }
  } else {
    applyProgress(await loadProgressWrapper(), false);
  }
}

// ==================== AUDIO ENGINE ====================
// `audioUnlocked` is only set inside a qualifying user gesture (click/keydown/touchstart):
// the autoplay policy blocks AudioContext creation/resume until then, and `mouseover`
// (hover SFX) does NOT count — gating on this flag kills the "not allowed to start" warning.
const AudioEngine = {
  ctx: null,
  masterGain: null,
  volume: 0.7,
  audioUnlocked: false,
  lastHoverTime: 0,
  HOVER_THROTTLE_MS: 150,

  init() {
    store.setState({ audioEnabled: storageGet('pixelWordHunter_muted') !== 'true' });
    this.volume = parseFloat(storageGet('pixelWordHunter_volume')) || 0.7;
    return true;
  },

  unlock() { this.audioUnlocked = true; this.ensureContext(); },

  ensureContext() {
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
    // Resume only after a gesture (unlock handles that); silent retry later.
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  },

  updateGain() {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(store.getState().audioEnabled ? this.volume : 0, this.ctx.currentTime);
    }
  },

  playTone(steps = []) {
    if (!this.audioUnlocked || !store.getState().audioEnabled || !steps.length || !this.ensureContext()) return;
    const t0 = this.ctx.currentTime;
    for (const s of steps) {
      const start = t0 + s.time;
      const end = start + s.duration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = s.type || 'square';
      osc.frequency.setValueAtTime(s.freq, start);
      if (s.slideTo) osc.frequency.exponentialRampToValueAtTime(s.slideTo, end);
      gain.connect(this.masterGain);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(s.volume || 0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.start(start);
      osc.stop(end);
    }
  },

  playCorrect() { this.playTone([{ time: 0, freq: 659, duration: 0.1 }, { time: 0.1, freq: 880, duration: 0.2 }]); },
  playWrong() { this.playTone([{ time: 0, freq: 220, duration: 0.1 }, { time: 0.1, freq: 110, duration: 0.2 }]); },
  playTransition() { this.playTone([{ time: 0, freq: 440, duration: 0.05, volume: 0.1 }]); },
  playHover() {
    const now = Date.now();
    if (now - this.lastHoverTime < this.HOVER_THROTTLE_MS) return;
    this.lastHoverTime = now;
    this.playTone([{ time: 0, freq: 150, duration: 0.05, volume: 0.05, type: 'sine' }]);
  },
};

// ==================== THEME MANAGER ====================
const ThemeManager = {
  apply(theme) { store.setTheme(theme); storageSet('pixelWordHunter_theme', theme); },
};

// ==================== AUTH MANAGER ====================
const AUTH_ERROR_KEYS = {
  'auth/invalid-credential': 'auth_invalid_credentials',
  'auth/wrong-password': 'auth_invalid_credentials',
  'auth/email-already-in-use': 'auth_email_in_use',
  'auth/weak-password': 'auth_weak_password',
  'auth/invalid-email': 'auth_invalid_email',
  'auth/too-many-requests': 'auth_too_many_requests',
  'auth/requires-recent-login': 'auth_requires_recent_login',
};
const localizeAuthError = (code) => t(AUTH_ERROR_KEYS[code] || 'authentication_failed');

async function retryAsync(task, { attempts = 3, delayMs = 400 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(delayMs * attempt);
    }
  }
  throw lastError;
}

/** Ensures Firebase is ready for email auth; small delay lets it fully settle. */
async function ensureFirebase(needDb) {
  if (firebaseAuth && (!needDb || firebaseDb)) return true;
  if (DEV) console.log('[Auth] Initializing Firebase services...');
  await initializeFirebaseServices();
  await wait(100);
  return !!firebaseAuth;
}

const AuthManager = {
  async register(username, email, password) {
    if (!(await ensureFirebase(true))) return { success: false, error: 'Firebase Auth failed to load.' };
    try {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(user, { displayName: username });
      if (firebaseDb) await setDoc(doc(firebaseDb, 'users', user.uid), { username, email, xp: 0, createdAt: new Date() });
      localStorage.setItem('pixelWordHunter_authMethod', 'email'); // prevents auto anonymous sign-in
      return { success: true };
    } catch (e) { return { success: false, error: localizeAuthError(e.code) }; }
  },

  async login(email, password) {
    if (!(await ensureFirebase(false))) return { success: false, error: 'Firebase Auth failed to load.' };
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      localStorage.setItem('pixelWordHunter_authMethod', 'email'); // prevents auto anonymous sign-in
      return { success: true };
    } catch (e) { return { success: false, error: localizeAuthError(e.code) }; }
  },

  async resetPassword(email) {
    if (!email) return { success: false, error: t('email_required') };
    try {
      if (!firebaseAuth) await initializeFirebaseServices();
      await sendPasswordResetEmail(firebaseAuth, email);
      return { success: true };
    } catch { return { success: false, error: t('password_reset_failed') }; }
  },

  async logout() {
    const mod = await import('./firebase-config.js');
    await mod.logoutUser();
  },

  async tryAnonymous() {
    const mod = await import('./firebase-config.js');
    return mod.signInAnonymouslyOnce();
  },

  /**
   * Permanently delete the current email account. The order is deliberate:
   * 1) re-authenticate first, without touching pending progress;
   * 2) freeze account sync and wait for any already-started writes to finish;
   * 3) atomically create a deletion tombstone and delete Firestore data while
   *    security rules still allow the owner;
   * 4) delete the Firebase Auth user;
   * 5) only then let the caller clear local account data.
   */
  async deleteAccount(password) {
    if (!firebaseAuth || !firebaseDb || !deleteUser || !writeBatch || !doc) await initializeFirebaseServices();
    const user = firebaseAuth?.currentUser;
    if (!user) return { success: false, error: localizeAuthError('auth/requires-recent-login') };
    if (user.isAnonymous || !user.email) return { success: false, error: t('authentication_failed') };
    if (!firebaseDb || !doc || !writeBatch || !serverTimestamp || !deleteUser || !EmailAuthProvider || !reauthenticateWithCredential) {
      return { success: false, error: t('delete_account_cloud_error') };
    }

    const uid = user.uid;

    // Password check happens before canceling queued saves — a typo must not
    // cost the learner unsynced XP/progress.
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } catch (error) {
      console.error('[Auth] Account re-authentication failed:', error.code || 'unknown', error.message);
      return { success: false, error: localizeAuthError(error.code) };
    }

    beginAccountDeletionSync(uid);

    if (!await waitForAccountCloudWrites(uid)) {
      abortAccountDeletionSync(uid);
      syncProgress().catch((error) => {
        console.warn('[Auth] Failed to reschedule progress sync after delete abort:', error.message);
      });
      return { success: false, error: t('delete_account_sync_busy') };
    }

    // From here a persistent deletion marker stops this client from recreating
    // the user's Firestore document if the page reloads before Auth deletion ends.
    markAccountDeletionCloudRemovalStarted(uid);

    try {
      await retryAsync(() => {
        const batch = writeBatch(firebaseDb);
        // The tombstone intentionally stays in Firestore: Security Rules then
        // reject late writes from stale tabs/devices unaware the account is gone.
        batch.set(doc(firebaseDb, 'deletedUsers', uid), { deletedAt: serverTimestamp() }, { merge: true });
        batch.delete(doc(firebaseDb, 'users', uid));
        return batch.commit();
      });
    } catch (error) {
      abortAccountDeletionSync(uid);
      syncProgress().catch((syncError) => {
        console.warn('[Auth] Failed to reschedule progress sync after cloud delete failure:', syncError.message);
      });
      console.error('[Auth] Firestore account data deletion failed:', error.code || 'unknown', error.message);
      return { success: false, error: t('delete_account_cloud_error') };
    }

    try {
      await retryAsync(() => deleteUser(user), { attempts: 2, delayMs: 500 });
      finishAccountDeletionSync(uid);
      return { success: true, uid };
    } catch (error) {
      // Cloud progress is already deleted. Keep the marker and local cleanup so
      // this browser cannot recreate the Firestore doc; sign in and retry later.
      sealAccountDeletionAfterCloudRemoval(uid);
      try {
        const { signOut } = await import('firebase/auth');
        await signOut(firebaseAuth);
      } catch (signOutError) {
        console.warn('[Auth] Sign out after partial account deletion failed:', signOutError.message);
      }
      console.error('[Auth] Firebase Auth user deletion failed after cloud cleanup:', error.code || 'unknown', error.message);
      return { success: false, partial: true, error: t('delete_account_partial_error') };
    }
  },
};

// ==================== APP LOGIC ====================
let ui = null;

function refreshCategoryButtons() {
  renderCategoryButtons(['All', ...getCategories()], (category) => startGame(category), getCategoryStats());
  // Preserve an active category filter when fresh progress bars are rendered.
  const search = $('category-search');
  if (search?.value) search.dispatchEvent(new Event('input'));
}

/** Registers the Workbox SW built by vite-plugin-pwa. injectRegister is off in
 *  vite.config.js (its inline script would be blocked by our CSP `script-src 'self'`),
 *  so registration happens here from same-origin code — without this there is no offline mode. */
function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const swUrl = new URL(`${import.meta.env.BASE_URL || './'}sw.js`, location.href).href;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('[App] Service worker registration failed:', err?.message || err);
    });
  });
}

// ==================== MODAL SHOW/HIDE ====================
const showModal = (modal) => { modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); };
const hideModal = (modal) => { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); };

// ==================== AUTH MODAL ====================
let lastFocusedElement = null;
let releaseAuthTrap = null;

function showAuthModal(mode) {
  store.setState({ authMode: mode });
  const isLogin = mode === 'login';
  ui.usernameField.style.display = isLogin ? 'none' : 'flex';
  ui.usernameField.setAttribute('aria-hidden', String(!isLogin));
  const usernameInput = $('auth-username');
  if (isLogin) usernameInput.setAttribute('tabindex', '-1');
  else usernameInput.removeAttribute('tabindex');

  ui.authTitle.textContent = t(isLogin ? 'login_title' : 'register_title');
  ui.authToggleText.textContent = t(isLogin ? 'need_account' : 'have_account');
  ui.authToggleBtn.textContent = t(isLogin ? 'toggle_register' : 'toggle_login');
  $('forgot-password-btn')?.classList.toggle('hidden', !isLogin);
  showModal(ui.authModal);

  lastFocusedElement = document.activeElement;
  // Yield first so the browser paints the modal before focus moves — this
  // reduces presentation delay and keeps the visual update in order.
  scheduleIdle(() => {
    const focusable = getFocusableElements(ui.authModal);
    if (focusable.length > 0) focusable[0].focus();
    else { ui.authModal.setAttribute('tabindex', '-1'); ui.authModal.focus(); }
    releaseAuthTrap = trapFocus(ui.authModal); // keep Tab inside the dialog
  }, { timeout: 100 });
}

async function handleAuthSubmit() {
  const mode = store.getState().authMode;
  const email = $('auth-email').value, password = $('auth-password').value, username = $('auth-username').value;
  ui.authSubmit.disabled = true;
  ui.authError.textContent = '';
  if (mode === 'register' && !username.trim()) {
    ui.authError.textContent = t('username_required');
    ui.authSubmit.disabled = false;
    return;
  }
  const result = mode === 'register'
    ? await AuthManager.register(username, email, password)
    : await AuthManager.login(email, password);

  if (result.success) {
    closeAuthModal();
    showNotification(t('auth_success'));
  } else {
    ui.authError.textContent = result.error || 'Authentication failed';
  }
  ui.authSubmit.disabled = false;
}

function closeAuthModal() {
  hideModal(ui.authModal);
  ui.authError.textContent = '';
  if (releaseAuthTrap) { releaseAuthTrap(); releaseAuthTrap = null; }
  if (lastFocusedElement && document.body.contains(lastFocusedElement)) lastFocusedElement.focus();
  lastFocusedElement = null;
}

// ==================== DELETE ACCOUNT FLOW ====================
let releaseDeleteTrap = null;

/** The word the user must type to confirm deletion, localized per UI language. */
const getDeleteWord = () => (t('delete_word') || 'delete').trim();
const isDeleteWordTyped = (value) =>
  String(value ?? '').trim().toLocaleLowerCase() === getDeleteWord().toLocaleLowerCase();

function openDeleteAccountModal() {
  const modal = $('delete-account-modal');
  const confirmInput = $('delete-confirm-input');
  if (!modal || !confirmInput) return;
  const passwordInput = $('delete-password-input');
  const confirmBtn = $('delete-confirm-btn');
  const cancelBtn = $('delete-cancel-btn');
  confirmInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = t('delete_account_confirm'); }
  if (cancelBtn) cancelBtn.disabled = false;
  confirmInput.disabled = false;
  if (passwordInput) passwordInput.disabled = false;
  setTxt($('delete-account-error'), '');
  setTxt($('delete-input-status'), '');
  confirmInput.setAttribute('placeholder', getDeleteWord());
  showModal(modal);
  scheduleIdle(() => {
    confirmInput.focus();
    releaseDeleteTrap = trapFocus(modal);
  }, { timeout: 100 });
}

function closeDeleteAccountModal() {
  const modal = $('delete-account-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  hideModal(modal);
  if (releaseDeleteTrap) { releaseDeleteTrap(); releaseDeleteTrap = null; }
}

async function handleDeleteAccountConfirm() {
  const modal = $('delete-account-modal');
  const confirmInput = $('delete-confirm-input');
  const passwordInput = $('delete-password-input');
  const confirmBtn = $('delete-confirm-btn');
  const cancelBtn = $('delete-cancel-btn');
  const errorEl = $('delete-account-error');
  if (!modal || !confirmInput || !confirmBtn) return;
  if (!isDeleteWordTyped(confirmInput.value)) return; // Button stays disabled anyway.
  if (!passwordInput?.value.trim()) {
    errorEl.textContent = t('delete_password_required');
    passwordInput.focus();
    return;
  }
  errorEl.textContent = '';
  confirmBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  confirmInput.disabled = true;
  if (passwordInput) passwordInput.disabled = true;
  confirmBtn.textContent = t('delete_account_deleting');

  const uid = store.getState().user?.uid;
  const result = await AuthManager.deleteAccount(passwordInput.value);
  const wipeLocal = () => {
    localStorage.removeItem('pixelWordHunter_authMethod');
    clearAccountData(uid);
    try {
      localStorage.removeItem('pwh_streak');
      localStorage.removeItem('pwh_lastPlayed');
    } catch { /* ignore */ }
  };
  if (result.success) {
    wipeLocal();
    showNotification(t('delete_account_success'));
    closeDeleteAccountModal();
    // Reload to fully reset app state and show the auth buttons.
    setTimeout(() => location.reload(), 1200);
  } else if (result.partial) {
    wipeLocal();
    showNotification(result.error || t('delete_account_partial_error'));
    closeDeleteAccountModal();
    // Auth data is already inconsistent from this device's point of view; a
    // reload returns to a clean guest state and prevents accidental writes.
    setTimeout(() => location.reload(), 2500);
  } else {
    confirmBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    confirmInput.disabled = false;
    if (passwordInput) passwordInput.disabled = false;
    confirmBtn.textContent = t('delete_account_confirm');
    errorEl.textContent = result.error || t('delete_account_error');
    passwordInput?.focus();
  }
}

// ==================== SCREENS / STATE ====================
const SCREENS = ['menu', 'settings', 'category', 'game'];

function toggleScreen(screenId) {
  for (const s of SCREENS) {
    const el = $(`${s}-screen`);
    if (!el) continue;
    el.classList.toggle('hidden', s !== screenId);
    el.style.display = s === screenId ? 'flex' : ''; // force display for the active screen
  }
}

function applyProgress(progressData, fromServer = false) {
  const words = getGameData();
  // Never leak the previous guest/account state when switching namespaces.
  for (const word of words) {
    word.mastery = 0; word.lastSeen = 0; word.correctCount = 0; word.incorrectCount = 0;
  }
  // Map lookup instead of Array.find per entry — O(n) overall, not O(n²).
  const wordsById = new Map(words.map((w) => [w.id, w]));
  setWordsIndex(wordsById);
  for (const [id, data] of Object.entries(progressData)) {
    const word = wordsById.get(id);
    if (word) Object.assign(word, data);
  }

  // Server XP wins over local when we are hydrating from the server.
  const xp = fromServer && typeof progressData.__xp === 'number' ? progressData.__xp : getUserXP();
  store.setState({ xp, masteredCount: getProgressStats().mastered });
  if (DEV) console.log(`[App] Progress applied: ${Object.keys(progressData).length} words, XP: ${xp}`);
}

function updateUI(state = store.getState()) {
  if (!ui) return;
  setTxt(ui.xpElement, `${state.xp} XP`);
  setTxt(ui.gameXpElement, `${state.xp} XP`);
  setTxt(ui.masteredCountElement, state.masteredCount);
  setTxt(ui.streakElement, state.dailyStreak || 0);

  // Identity in settings
  if (ui.settingsUserElement) {
    const u = state.user;
    const who = u && (u.email || u.displayName) ? `👤 ${u.displayName || u.email}` : '';
    ui.settingsUserElement.textContent = who;
    ui.settingsUserElement.classList.toggle('hidden', !who);
  }

  // Auth buttons must match the actual auth state — the localStorage token
  // guard prevents "ghost" authorization after failed/removed sign-ins.
  const isActuallyAuthenticated = state.isAuthenticated && localStorage.getItem('pixelWordHunter_authMethod') !== null;
  $('auth-buttons')?.classList.toggle('hidden', isActuallyAuthenticated);
  $('hunt-btn')?.classList.toggle('hidden', !isActuallyAuthenticated);

  // Account deletion only makes sense for a real email account, not guests.
  const deleteSection = $('delete-account-section');
  if (deleteSection) {
    const canDelete = !!state.user && !state.user.isAnonymous && isActuallyAuthenticated;
    deleteSection.classList.toggle('hidden', !canDelete);
  }

  const soundOn = state.audioEnabled;
  setTxt($('settings-sound-icon'), soundOn ? '🔊' : '🔇');
  setTxt($('settings-sound-label'), t(soundOn ? 'on' : 'off'));
  $('settings-sound-btn')?.setAttribute('aria-pressed', String(soundOn));

  for (const [selector, field] of [['[data-theme]', 'theme'], ['[data-lang]', 'uiLanguage']]) {
    document.querySelectorAll(selector).forEach((btn) => {
      const active = btn.dataset[field] === state[field];
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  const hardBtn = $('hard-words-btn');
  if (hardBtn) {
    const count = selectHardWords(600).length;
    hardBtn.disabled = count === 0;
    hardBtn.textContent = `${t('hard_words')} · ${count}`;
  }
}

// ==================== GAME FLOW ====================
const REVIEW_TRIGGER_ROUNDS = 3; // Show review after this many rounds
const RECALL_QUESTION_RATE = 0.25;

function startRound(category, words, emptyMessage) {
  if (!words.length) { showNotification(emptyMessage); return; }
  store.setState({
    currentCategory: category,
    currentRound: words,
    currentQ: 0,
    roundScore: 0,
    reviewSessionData: [],
    completedRoundsCount: 0,
  });
  setTxt($('category'), category);
  toggleScreen('game');
  loadQuestion();
}

function startGame(category) {
  AudioEngine.playTransition();
  startRound(category, selectWordsForRound(category, 10), t('no_words') || 'No words available');
}

/** Round made only of "hard" words (more wrong than right, or seen-but-not-mastered). */
function startHardWords() {
  startRound('Hard', selectHardWords(10), t('no_hard_words') || 'No hard words yet — keep playing!');
}

// ==================== DAILY STREAK ====================
function updateDailyStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const last = storageGet('pwh_lastPlayed');
  let streak = parseInt(storageGet('pwh_streak'), 10) || 0;
  if (last !== today) { // count the day once; missed a day → reset
    streak = last === yesterday ? streak + 1 : 1;
    storageSet('pwh_lastPlayed', today);
    storageSet('pwh_streak', String(streak));
  }
  store.setState({ dailyStreak: streak });
}

// ==================== SPEECH SYNTHESIS (on demand only) ====================
const Speech = {
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  speak(text, lang = 'en') {
    if (!this.supported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'ko' ? 'ko-KR' : lang === 'ru' ? 'ru-RU' : 'en-US';
      u.rate = 0.95;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  },
};

/** Turns an element into a tap-to-pronounce control. Nothing is spoken automatically. */
function makeWordSpeakable(element, text, lang = 'en') {
  element.title = t('pronounce_hint');
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  const speak = () => { if (text) Speech.speak(text, lang); };
  element.addEventListener('click', speak);
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); speak(); }
  });
}

// ==================== CUSTOM CONFIRM MODAL ====================
/** Themed replacement for window.confirm(): in-DOM modal so it inherits the
 *  game aesthetic and stays inside the PWA shell. */
function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = mk('div', 'modal confirm-modal');
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="confirm-box">
        <p class="confirm-message"></p>
        <div class="confirm-actions">
          <button class="option-btn confirm-ok">${t('yes') || 'YES'}</button>
          <button class="option-btn confirm-cancel">${t('no') || 'NO'}</button>
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

// ==================== ANSWER CHECKING ====================
/** Capitalization and punctuation never count as mistakes. For translations
 *  with several comma-separated glosses, any one accepted gloss is enough in recall mode. */
function normalizeTypedAnswer(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isAnswerCorrect(selected, word, lang, questionIsEnglish, answerMode = 'choice') {
  const expected = getCorrectTranslation(word, lang, questionIsEnglish);
  if (answerMode !== 'recall') return selected === expected;
  const actual = normalizeTypedAnswer(selected);
  if (!actual) return false;
  // Dictionaries may hold multiple valid glosses ("гарантия, заверение") —
  // do not punish a learner for typing one of them.
  const accepted = questionIsEnglish ? [expected, ...expected.split(/[,;/|]/)] : [expected];
  return accepted.some((answer) => normalizeTypedAnswer(answer) === actual);
}

// ==================== QUESTION FLOW ====================
function loadQuestion() {
  const { currentRound, currentQ, translationLanguage } = store.getState();
  const word = currentRound?.[currentQ];
  if (!word) { showNotification(t('no_words')); toggleScreen('menu'); return; }
  const question = getQuestionWord(word, translationLanguage);
  // Free recall appears only for words already seen once; new words get the
  // easier multiple-choice introduction first.
  const recallMode = Boolean(word.lastSeen) && Math.random() < RECALL_QUESTION_RATE;

  // The word itself is the pronunciation control: no adjacent speaker icon.
  ui.wordElement.textContent = question.text;
  ui.wordElement.className = `word-button lang-${question.isEnglish ? 'en' : translationLanguage}`;
  ui.wordElement.setAttribute('aria-label', `${question.text}. ${t('pronounce_hint')}`);
  ui.wordElement.onclick = () => Speech.speak(question.text, question.isEnglish ? 'en' : translationLanguage);

  const total = currentRound.length;
  setTxt($('question-progress-text'), t('question_progress')
    .replace('{current}', currentQ + 1)
    .replace('{total}', total));
  const fill = $('question-progress-fill');
  if (fill) fill.style.width = `${((currentQ + 1) / total) * 100}%`;

  ui.optionsElement.textContent = '';
  ui.optionsElement.classList.toggle('hidden', recallMode);
  ui.recallFormElement?.classList.toggle('hidden', !recallMode);
  ui.recallAnswerElement?.classList.remove('correct', 'wrong');

  if (recallMode) {
    const answer = ui.recallAnswerElement;
    answer.value = '';
    answer.disabled = false;
    ui.recallSubmitElement.disabled = false;
    answer.setAttribute('aria-label', t('recall_placeholder'));
    // Focusing makes the harder retrieval mode immediately usable on desktop
    // and mobile without an extra tap.
    requestAnimationFrame(() => answer.focus());
    ui.recallFormElement.onsubmit = (event) => {
      event.preventDefault();
      if (!answer.value.trim()) {
        showNotification(t('answer_required'));
        answer.focus();
        return;
      }
      checkAnswer(answer.value, word, null, question.isEnglish, 'recall');
    };
  } else {
    generateOptionsForWord(word, translationLanguage, question.isEnglish).forEach((opt, index) => {
      // Tag each option with its language so English answers use Press Start 2P
      // (like the EN UI) while Korean translations use Mulmaru under lang-ko.
      const btn = mk('button', `option-btn lang-${question.isEnglish ? translationLanguage : 'en'}`, opt);
      btn.setAttribute('aria-label', `Option ${index + 1}: ${opt}`);
      btn.addEventListener('click', () => checkAnswer(opt, word, btn, question.isEnglish));
      ui.optionsElement.appendChild(btn);
    });
  }

  ui.explanationModal.classList.add('hidden');
  store.setState({ isAnswerLocked: false });
}

function checkAnswer(selected, word, btn, questionIsEnglish, answerMode = 'choice') {
  const state = store.getState();
  if (state.isAnswerLocked) return;
  store.setState({ isAnswerLocked: true });
  updateDailyStreak();

  const currentLang = store.getState().translationLanguage;
  const isCorrect = isAnswerCorrect(selected, word, currentLang, questionIsEnglish, answerMode);
  const recall = answerMode === 'recall';
  for (const option of ui.optionsElement.children) option.disabled = true;
  if (recall) { ui.recallAnswerElement.disabled = true; ui.recallSubmitElement.disabled = true; }

  if (isCorrect) {
    btn?.classList.add('correct');
    if (recall) ui.recallAnswerElement.classList.add('correct');
    AudioEngine.playCorrect();
    addXP(10); // simple scoring; atomic increment keeps multi-tab XP in sync
    store.setState({ roundScore: state.roundScore + 1 });
    updateWordProgress(word.id, true);
  } else {
    btn?.classList.add('wrong');
    if (recall) ui.recallAnswerElement.classList.add('wrong');
    AudioEngine.playWrong();
    updateWordProgress(word.id, false);
    const correctAnswer = getCorrectTranslation(word, currentLang, questionIsEnglish);
    for (const b of ui.optionsElement.children) {
      if (b.textContent === correctAnswer) b.classList.add('correct');
    }
  }

  // Track this result for the post-round review session (kept in the store).
  store.setState({
    reviewSessionData: [...store.getState().reviewSessionData, { word, isCorrect }],
  });

  // Defer the local save (the expensive localStorage write) to idle time so
  // pending interactions are processed first; Firebase sync is debounced
  // inside saveProgress itself.
  scheduleIdle(() => syncProgress());
  setTimeout(() => showExplanation(word), 1000);
}

/** Renders the English word, its translation, and the example sentence in the
 *  selected language. Korean UI never shows Russian (and vice versa). */
function appendWordReviewContent(container, word, lang) {
  const wP = mk('p', 'explanation-word', word.eng);
  makeWordSpeakable(wP, word.eng); // pronunciation only on demand
  container.appendChild(wP);
  container.appendChild(mk('p', `explanation-definition lang-${lang === 'ko' ? 'ko' : 'ru'}`,
    getWordTranslation(word, lang) || word.eng));

  if (!word.exampleEng) return;
  const box = mk('div', 'explanation-example-container');
  box.appendChild(mk('p', 'explanation-example-en', word.exampleEng));
  const example = getExampleTranslation(word, lang);
  if (example.text) box.appendChild(mk('p', `explanation-example-${example.usedLang}`, example.text));
  container.appendChild(box);
}

function showExplanation(word) {
  const list = $('explanation-list');
  $('next-question-btn').style.display = 'inline-block';
  list.textContent = '';
  list.setAttribute('role', 'list');
  const content = mk('div', 'explanation-content');
  appendWordReviewContent(content, word, store.getState().translationLanguage);
  list.appendChild(content);
  ui.explanationModal.classList.remove('hidden');
}

function nextQuestion() {
  const state = store.getState();
  if (state.currentQ >= state.currentRound.length - 1) {
    store.setState({ completedRoundsCount: state.completedRoundsCount + 1 });
    showRoundResult();
  } else {
    store.setState({ currentQ: state.currentQ + 1 });
    loadQuestion();
  }
}

function showRoundResult() {
  const state = store.getState();
  ui.explanationModal.classList.add('hidden');
  const modal = $('result-modal');
  const summary = $('result-summary');
  const total = state.currentRound.length;
  const correct = state.roundScore;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  summary.textContent = '';
  for (const [label, value] of [
    [t('correct_count'), correct],
    [t('wrong_count'), total - correct],
    [t('accuracy'), `${accuracy}%`],
    [t('xp_earned'), correct * 10],
  ]) {
    summary.appendChild(mk('p', null, `${label}: ${value}`));
  }

  modal.classList.remove('hidden');
  const releaseTrap = trapFocus(modal);
  const close = () => { releaseTrap(); modal.classList.add('hidden'); };

  $('result-continue-btn').onclick = () => {
    close();
    const latest = store.getState();
    if (latest.completedRoundsCount >= REVIEW_TRIGGER_ROUNDS && latest.reviewSessionData.length) {
      showReviewSession();
      return;
    }
    store.setState({
      currentRound: selectWordsForRound(latest.currentCategory, 10),
      currentQ: 0,
      roundScore: 0,
    });
    loadQuestion();
  };
  $('result-review-btn').onclick = () => {
    const mistakes = store.getState().reviewSessionData.filter((x) => !x.isCorrect).map((x) => x.word);
    if (!mistakes.length) { showNotification(t('no_mistakes')); return; }
    close();
    store.setState({
      currentCategory: 'Hard',
      currentRound: mistakes,
      currentQ: 0,
      roundScore: 0,
      reviewSessionData: [],
    });
    loadQuestion();
  };
  $('result-exit-btn').onclick = () => { close(); toggleScreen('menu'); };
  $('result-continue-btn').focus();
}

/** Word Review session after REVIEW_TRIGGER_ROUNDS rounds (Quizlet-style). */
function showReviewSession() {
  const { reviewSessionData, translationLanguage: lang } = store.getState();
  const list = $('explanation-list');
  document.querySelector('#explanation-modal .modal-title').textContent = t('word_review');
  const nextBtn = $('next-question-btn');
  nextBtn.style.display = 'none';
  list.textContent = '';
  list.setAttribute('role', 'list');

  if (reviewSessionData.length === 0) {
    const listItem = mk('div');
    listItem.setAttribute('role', 'listitem');
    const perfectMsg = mk('p', 'explanation-definition', t('perfect'));
    perfectMsg.style.color = 'var(--neon-green)';
    listItem.appendChild(perfectMsg);
    list.appendChild(listItem);
  } else {
    // Review cards for ALL words of the session: green for correct, red for wrong.
    for (const { word, isCorrect } of reviewSessionData) {
      const card = mk('div', `review-card ${isCorrect ? 'correct' : 'wrong'}`);
      card.setAttribute('role', 'listitem');
      appendWordReviewContent(card, word, lang);
      card.appendChild(mk('p', 'review-status',
        isCorrect ? `✓ ${t('correct_count')}` : `✗ ${t('needs_review')}`));
      list.appendChild(card);
    }
  }

  const continueBtn = mk('button', 'option-btn continue-after-review-btn', t('continue'));
  continueBtn.id = 'continue-after-review-btn';
  continueBtn.setAttribute('aria-label', 'Continue to next round');
  continueBtn.addEventListener('click', () => {
    store.setState({ reviewSessionData: [], completedRoundsCount: 0 });
    nextBtn.style.display = 'inline-block';
    // Reset the score too so the next result screen is not 20/10.
    const state = store.getState();
    store.setState({
      currentRound: selectWordsForRound(state.currentCategory, 10),
      currentQ: 0,
      roundScore: 0,
    });
    loadQuestion();
  });
  list.appendChild(continueBtn);
  ui.explanationModal.classList.remove('hidden');
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Navigation — every screen switch plays the transition blip.
  const nav = (id, screen) => on(id, 'click', () => { AudioEngine.playTransition(); toggleScreen(screen); });
  nav('settings-btn', 'settings');
  nav('settings-back-btn', 'menu');
  nav('category-back-btn', 'menu');
  nav('exit-game-btn', 'menu');

  // Auth
  on('login-modal-btn', 'click', () => showAuthModal('login'));
  on('register-modal-btn', 'click', () => showAuthModal('register'));
  on('auth-close-btn', 'click', () => { AudioEngine.playTransition(); closeAuthModal(); });
  on('auth-toggle-btn', 'click', () => showAuthModal(store.getState().authMode === 'login' ? 'register' : 'login'));
  on('auth-submit', 'click', handleAuthSubmit);
  on('forgot-password-btn', 'click', async () => {
    const result = await AuthManager.resetPassword($('auth-email').value.trim());
    if (result.success) showNotification(t('password_reset_sent'));
    else ui.authError.textContent = result.error;
  });
  on('auth-modal', 'click', (e) => { if (e.target?.id === 'auth-modal') closeAuthModal(); }); // click outside closes
  on('auth-form', 'keydown', (e) => { // Enter inside any input submits
    if (e.key === 'Enter') { e.preventDefault(); handleAuthSubmit(); }
  });

  // Settings
  document.querySelectorAll('[data-theme]').forEach((btn) =>
    btn.addEventListener('click', () => ThemeManager.apply(btn.dataset.theme)));
  document.querySelectorAll('[data-lang]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      await I18nManager.setLanguage(lang);
      // Vocabulary translation follows the UI language (ko → ko, else → ru).
      store.setState({ uiLanguage: lang, translationLanguage: lang === 'ko' ? 'ko' : 'ru' });
    }));
  on('settings-sound-btn', 'click', () => store.toggleAudio());

  // Menu actions
  on('hunt-btn', 'click', () => {
    AudioEngine.playTransition();
    refreshCategoryButtons();
    toggleScreen('category');
  });
  on('try-btn', 'click', () => {
    AudioEngine.playTransition();
    // Explicit anonymous sign-in for guest mode. Falls back to offline play.
    AuthManager.tryAnonymous?.().catch(() => {});
    refreshCategoryButtons();
    toggleScreen('category');
  });
  on('hard-words-btn', 'click', () => { AudioEngine.playTransition(); startHardWords(); });

  // Backup / reset
  on('export-btn', 'click', exportProgress);
  on('import-input', 'change', async (e) => {
    const result = await importProgress(e.target.files[0]);
    if (result?.success) {
      // Rehydrate progress and validated backup settings without a reload.
      applyProgress(result.progress || {}, false);
      const imported = result.settings || {};
      if (imported.theme) ThemeManager.apply(imported.theme);
      if (imported.language) {
        // Persist even when the imported language already matches the current
        // browser-selected language (setLanguage otherwise returns early).
        storageSet('pixelWordHunter_language', imported.language);
        await I18nManager.setLanguage(imported.language);
        store.setState({
          uiLanguage: imported.language,
          translationLanguage: imported.language === 'ko' ? 'ko' : 'ru',
        });
      }
      if (typeof imported.audio === 'boolean') {
        storageSet('pixelWordHunter_muted', String(!imported.audio));
        store.setState({ audioEnabled: imported.audio });
      }
      refreshCategoryButtons();
      // For email accounts these calls also schedule restored card data and
      // intentionally replace cloud XP with the backup value. Guest imports
      // remain local-only.
      try {
        await syncProgress();
        if (result.xp !== null) await syncXPToCloud(result.xp);
      } catch (error) {
        // The local restore is already complete; cloud sync can retry later.
        console.warn('[Backup] Cloud sync after import failed:', error.message);
      }
      showNotification(t('import_success') || 'Import successful');
    } else if (result) {
      showNotification(t('import_invalid') || 'Invalid backup file');
    }
    e.target.value = ''; // allow re-importing the same file
  });

  on('reset-progress-btn', 'click', async () => {
    if (!await confirmDialog(t('reset_progress_confirm') || 'Reset all progress?')) return;
    const cloud = store.getState().isAuthenticated ? await confirmDialog(t('reset_cloud')) : false;
    await resetProgress({ cloud });
    applyProgress({}, false);
    refreshCategoryButtons();
    showNotification(t('progress_reset') || 'Progress reset');
  });

  on('logout-btn', 'click', async () => {
    await flushPendingXP();
    await AuthManager.logout();
    showNotification(t('logged_out') || 'Logged out successfully');
    location.reload(); // fully reset app state and show login buttons
  });

  // Delete account
  on('delete-account-btn', 'click', () => { AudioEngine.playTransition(); openDeleteAccountModal(); });
  on('delete-confirm-input', 'input', (e) => {
    const ok = isDeleteWordTyped(e.target.value);
    const confirmBtn = $('delete-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = !ok;
    setTxt($('delete-input-status'), ok ? t('delete_word_matches') : '');
  });
  on('delete-confirm-btn', 'click', handleDeleteAccountConfirm);
  on('delete-cancel-btn', 'click', () => { AudioEngine.playTransition(); closeDeleteAccountModal(); });
  on('delete-account-modal', 'click', (e) => { if (e.target?.id === 'delete-account-modal') closeDeleteAccountModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDeleteAccountModal(); });

  // next-question-btn is also the Enter/Space target while the answer is locked
  on('next-question-btn', 'click', nextQuestion);

  // Global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const resultModal = $('result-modal');
    if (resultModal && !resultModal.classList.contains('hidden')) {
      if (e.key === 'Escape') $('result-exit-btn')?.click();
      return;
    }

    const state = store.getState();
    if (!ui.gameScreenElement.classList.contains('hidden')) {
      if (!state.isAnswerLocked) {
        if (e.key >= '1' && e.key <= '4') {
          const options = ui.optionsElement.querySelectorAll('.option-btn');
          options[Number(e.key) - 1]?.click();
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        $('next-question-btn')?.click();
      }
    }

    if (e.key === 'Escape') { // close open modals
      if (!ui.authModal.classList.contains('hidden')) ui.authModal.classList.add('hidden');
      else if (!ui.explanationModal.classList.contains('hidden')) ui.explanationModal.classList.add('hidden');
    } else if (!ui.menuScreenElement.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const huntBtn = $('hunt-btn');
      const menuAction = huntBtn && !huntBtn.classList.contains('hidden') ? huntBtn : $('try-btn');
      menuAction?.click();
    }
  });

  // Cloud sync status chip
  window.addEventListener('pwh:syncStatus', (e) => {
    const status = e.detail?.status;
    const wrap = $('sync-status');
    const text = $('sync-text');
    const retry = $('retry-sync-btn');
    if (!wrap || !text) return;
    wrap.classList.remove('hidden');
    text.textContent = t(status || 'syncing');
    retry?.classList.toggle('hidden', status !== 'sync_error');
    if (status === 'synced') setTimeout(() => wrap.classList.add('hidden'), 1800);
  });
  on('retry-sync-btn', 'click', () => syncProgress());

  // Hover sound (delegated; gated on the unlock flag, so autoplay policy is safe)
  document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('.option-btn, .category-btn, .theme-btn')) {
      AudioEngine.playHover();
    }
  });
}

// ==================== BOOT ====================
async function init() {
  try {
    ui = initUI();
    AudioEngine.init();
    registerServiceWorker();
    // initializeFirebaseServices() runs lazily on first need.
    await I18nManager.init();
    const uiLanguage = I18nManager.getCurrentLanguage();
    // Vocabulary translation follows the UI language: Korean UI → Korean
    // translations, anything else → Russian. No separate toggle needed.
    store.setState({ uiLanguage, translationLanguage: uiLanguage === 'ko' ? 'ko' : 'ru' });

    // Let the browser paint the initial UI / handle input before heavy loading.
    await yieldToMain();

    // Unlock audio on the first qualifying user gesture (click/keydown/touchstart).
    const unlockAudio = () => {
      AudioEngine.unlock();
      for (const ev of ['click', 'keydown', 'touchstart']) document.removeEventListener(ev, unlockAudio);
    };
    for (const ev of ['click', 'keydown', 'touchstart']) document.addEventListener(ev, unlockAudio, { once: true });

    await loadGameData();
    await yieldToMain(); // between data and progress loading, keep the thread responsive
    applyProgress(await loadProgressWrapper());
    await yieldToMain();

    ThemeManager.apply(storageGet('pixelWordHunter_theme') || 'cyberpunk');
    refreshCategoryButtons();
    wireCategorySearch('category-search', 'category-list');
    setupEventListeners();

    // App state listener for UI reactivity (store batches these via rAF).
    store.addEventListener('stateChange', (e) => {
      const { state, changedKeys } = e.detail;
      if (changedKeys.includes('audioEnabled')) {
        AudioEngine.updateGain();
        storageSet('pixelWordHunter_muted', String(!state.audioEnabled));
      }
      if (changedKeys.includes('theme')) storageSet('pixelWordHunter_theme', state.theme);
      updateUI(state);
    });

    toggleScreen('menu');

    // Global auth event bridge — the ONE listener lives in firebase-config.js.
    window.addEventListener('pwh:authStateChanged', (e) => handleAuthStateChanged(e.detail?.user || null));

    // Streak is updated on the first answered question, not merely on app open.
    store.setState({ dailyStreak: parseInt(storageGet('pwh_streak'), 10) || 0 });

    // PWA shortcut URLs (?action=quick|hard)
    const action = new URLSearchParams(location.search).get('action');
    if (action === 'quick') requestAnimationFrame(() => startGame('All'));
    else if (action === 'hard') requestAnimationFrame(() => startHardWords());

    // Fallback: ensure at least one screen is visible shortly after boot.
    setTimeout(() => {
      if (!document.querySelector('.game-container:not(.hidden)')) {
        if (DEV) console.warn('[App] No screen visible, forcing menu screen');
        toggleScreen('menu');
      }
    }, 500);

    // Preload Firebase modules during idle so clicking LOGIN/REGISTER does not
    // pay the dynamic-import cost inside the interaction itself.
    if (localStorage.getItem('pixelWordHunter_authMethod')) {
      scheduleIdle(() => {
        import('./firebase-config.js').then((m) => m.initFirebase?.()).catch(() => {});
      }, { timeout: 3000 });
    }
  } catch (err) {
    console.error('[App] Initialization failed:', err);
    const loadErrorEl = $('load-error');
    if (loadErrorEl) {
      loadErrorEl.textContent = `Initialization Error: ${err.message}. Please refresh the page.`;
      loadErrorEl.hidden = false;
      Object.assign(loadErrorEl.style, {
        display: 'block', padding: '20px', color: 'var(--neon-pink)', textAlign: 'center',
      });
    }
    toggleScreen('menu'); // still try to show the menu screen as a fallback
  }
}

init();
