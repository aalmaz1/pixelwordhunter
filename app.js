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
  generateOptionsForWord,
  updateWordProgress,
  getCategories,
  getProgressStats,
  getCorrectTranslation,
  getQuestionWord
} from './data.js';
import {
  saveProgress,
  loadProgress,
  storageGet,
  storageSet,
  setUserXP,
  getUserXP,
  addXP,
  resetProgress,
  exportProgress,
  importProgress
} from './storage.js';
import { initUI, renderCategoryButtons, showNotification, getFocusableElements } from './ui.js';

// Локальные переменные для Firebase-сервисов и функций
let firebaseAuth, firebaseDb;
let createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut, onAuthStateChanged;
let doc, setDoc, serverTimestamp;

/**
 * Динамически импортирует и инициализирует Firebase-сервисы.
 * Вызывается только при необходимости.
 */
async function initializeFirebaseServices() {
  // Динамический импорт firebase-config.js
  const firebaseConfigModule = await import('./firebase-config.js');
  await firebaseConfigModule.initFirebase(); // Инициализируем Firebase-приложение

  firebaseAuth = firebaseConfigModule.firebaseAuth;
  firebaseDb = firebaseConfigModule.firebaseDb;

  // Динамический импорт функций аутентификации
  const authModule = await import('firebase/auth');
  createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
  signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
  updateProfile = authModule.updateProfile;
  signOut = authModule.signOut;
  onAuthStateChanged = authModule.onAuthStateChanged;

  // Динамический импорт функций Firestore
  const firestoreModule = await import('firebase/firestore');
  doc = firestoreModule.doc;
  setDoc = firestoreModule.setDoc;
  serverTimestamp = firestoreModule.serverTimestamp;

  // Теперь firebaseAuth и firebaseDb доступны, можно настроить слушатель
  if (firebaseAuth) {
    onAuthStateChanged(firebaseAuth, async (user) => {
      store.setUser(user);
      if (user) {
        const progress = await loadProgress(firebaseDb, doc, firestoreModule.getDoc);
        applyProgress(progress);
      }
    });
  }
}

// ==================== AUDIO ENGINE ====================
const AudioEngine = {
  ctx: null,
  masterGain: null,
  volume: 0.7,
  lastHoverTime: 0,
  HOVER_THROTTLE_MS: 150, // Минимальный интервал между звуками hover (мс)

  init() {
    const isMuted = storageGet('pixelWordHunter_muted') === 'true';
    store.setState({ audioEnabled: !isMuted });

    this.volume = parseFloat(storageGet('pixelWordHunter_volume')) || 0.7;
    return true;
  },

  updateGain() {
    if (this.masterGain && this.ctx) {
      const isMuted = !store.getState().audioEnabled;
      this.masterGain.gain.setValueAtTime(isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  },

  ensureContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.updateGain();
      } catch {
        return false;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  },

  playTone(steps = []) {
    if (!this.ensureContext() || !store.getState().audioEnabled || steps.length === 0) return;
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
    // Проверяем, что Firebase Auth загружен
    if (!firebaseAuth) {
      console.warn('Firebase Auth not loaded. Attempting to load...');
      await initializeFirebaseServices(); // Попытка загрузить, если еще не загружено
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
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  },

  async login(email, password) {
    // Проверяем, что Firebase Auth загружен
    if (!firebaseAuth) {
      console.warn('Firebase Auth not loaded. Attempting to load...');
      await initializeFirebaseServices(); // Попытка загрузить, если еще не загружено
      if (!firebaseAuth) return { success: false, error: 'Firebase Auth failed to load.' };
    }
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  },

  async logout() {
    if (firebaseAuth) await signOut(firebaseAuth);
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

    // Unlock audio on first interaction
    const unlockAudio = () => {
      AudioEngine.ensureContext();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    // Load Data
    await loadGameData();
    const progress = await loadProgress();
    applyProgress(progress);

    // Initial UI state
    const theme = storageGet('pixelWordHunter_theme') || 'cyberpunk';
    ThemeManager.apply(theme);

    const categories = ['All', ...getCategories()];
    renderCategoryButtons(categories, (cat) => startGame(cat));

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

    // Fallback: Ensure at least one screen is visible after a short delay
    setTimeout(() => {
      const visibleScreen = document.querySelector('.game-container:not(.hidden)');
      if (!visibleScreen) {
        console.warn('[App] No screen visible, forcing menu screen');
        toggleScreen('menu');
      }
    }, 500);
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

  document.getElementById('export-btn')?.addEventListener('click', exportProgress);
  document.getElementById('import-input')?.addEventListener('change', (e) => importProgress(e.target.files[0]));
  document.getElementById('reset-progress-btn')?.addEventListener('click', () => {
    if (confirm('Reset all progress?')) {
      resetProgress();
      location.reload();
    }
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
        document.getElementById('hunt-btn')?.click();
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
  
  setTimeout(() => {
    const focusable = getFocusableElements(ui.authModal);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      ui.authModal.setAttribute('tabindex', '-1');
      ui.authModal.focus();
    }
  }, 50);
}

async function handleAuthSubmit() {
  const mode = store.getState().authMode;
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value;

  ui.authSubmit.disabled = true;
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
    ui.authError.textContent = result.error;
  }
  ui.authSubmit.disabled = false;
}

function closeAuthModal() {
  ui.authModal.classList.add('hidden');
  ui.authModal.setAttribute('aria-hidden', 'true');
  ui.authError.textContent = '';
  
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

function applyProgress(progressData) {
  const words = getGameData();
  Object.entries(progressData).forEach(([eng, data]) => {
    const word = words.find(w => w.eng === eng);
    if (word) Object.assign(word, data);
  });

  const stats = getProgressStats();
  store.setState({
    xp: getUserXP(),
    masteredCount: stats.mastered,
    learningCount: stats.learning,
    reviewCount: stats.newWords
  });
}

function updateUI(state = store.getState()) {
  if (!ui) return;

  // XP
  if (ui.xpElement) ui.xpElement.textContent = `${state.xp} XP`;
  if (ui.gameXpElement) ui.gameXpElement.textContent = `${state.xp} XP`;

  // Stats
  if (ui.masteredCountElement) ui.masteredCountElement.textContent = state.masteredCount;

  // Auth
  const authButtons = document.getElementById('auth-buttons');
  const huntBtn = document.getElementById('hunt-btn');
  if (state.isAuthenticated) {
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

function loadQuestion() {
  const { currentRound, currentQ, language } = store.getState();
  const word = currentRound[currentQ];
  const questionData = getQuestionWord(word, language);

  ui.wordElement.textContent = questionData.text;
  ui.wordElement.className = `lang-${language} typewriter`;

  const options = generateOptionsForWord(word, language, questionData.isEnglish);
  ui.optionsElement.textContent = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
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
    AudioEngine.playCorrect();
    const bonus = 10; // Simple scoring
    // Use atomic XP increment for multi-tab synchronization
    addXP(bonus);
    updateWordProgress(word.eng, true);
  } else {
    btn.classList.add('wrong');
    AudioEngine.playWrong();
    updateWordProgress(word.eng, false);

    // Highlight correct
    const correctAnswer = getCorrectTranslation(word, currentLang, questionIsEnglish);
    Array.from(ui.optionsElement.children).forEach(b => {
      if (b.textContent === correctAnswer) {
        b.classList.add('correct');
      }
    });
  }

  // Add to review session data (using store state)
  const currentState = store.getState();
  const updatedReviewData = [...currentState.reviewSessionData, wordResult];
  store.setState({ reviewSessionData: updatedReviewData });

  saveProgress(firebaseDb, doc, setDoc, serverTimestamp);
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

    // Start new round
    const roundWords = selectWordsForRound(state.currentCategory, 10);
    store.setState({
      currentRound: roundWords,
      currentQ: 0,
      completedRoundsCount: 0 // Reset counter for next batch of 3 rounds
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