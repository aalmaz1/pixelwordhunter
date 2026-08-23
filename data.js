/**
 * data.js
 * Word data management, sanitization, and SRS logic
 *
 * INP CRITICAL FIX: The words JSON (243KB) is NO LONGER statically imported.
 * Previously, `import wordsData from './words_optimized.json'` caused Vite
 * to inline the entire JSON as a JSON.parse(`...`) call in the main bundle,
 * creating a 200ms+ long task at module evaluation time that blocked ALL
 * user interactions (INP input delay of 215-235ms).
 *
 * Now the JSON is loaded via fetch() and parsed + sanitized in a Web Worker.
 * The main thread only parses it as a compatibility fallback when the Worker
 * cannot start. Normal-path blocking is limited to the structured clone.
 */

import { store } from './store.js';
import { sanitizeToeicData, UNCONFIRMED_MARKER as SANITIZE_UNCONFIRMED } from './sanitize.js';

let gameData = null;
let categoriesCache = null;
let dataLoadPromise = null;
let wordsById = null; // O(1) lookup index — IDs remain unique across repeated terms
const WORDS_DATA_REVISION = typeof __WORDS_DATA_REVISION__ === 'string' ? __WORDS_DATA_REVISION__ : '';

function rebuildWordsIndex() {
  if (!gameData) { wordsById = null; return; }
  wordsById = new Map(gameData.map(w => [w.id, w]));
}

/**
 * Allow callers (e.g. app.js.applyProgress) to inject a pre-built
 * index if they already computed one. Keeps a single source of truth.
 */
export function setWordsIndex(map) {
  if (map instanceof Map) wordsById = map;
}

/**
 * Test helper — inject a synthetic gameData array without going through fetch.
 * Only used from Vitest; safe in production since it's a no-op there.
 */
export function _setGameDataForTests(arr) {
  if (Array.isArray(arr)) arr.forEach((word, index) => { word.id ||= `test-${index}-${word.eng}`; });
  gameData = Array.isArray(arr) ? arr : null;
  rebuildWordsIndex();
  categoriesCache = null;
}

const INTERVALS = {
  0: 0,
  1: 60 * 60 * 1000,
  2: 6 * 60 * 60 * 1000,
  3: 24 * 60 * 60 * 1000,
  4: 72 * 60 * 60 * 1000,
  5: 168 * 60 * 60 * 1000,
};

/**
 * Yield control back to the browser so it can process pending
 * interactions and paints. Breaks long tasks to reduce INP.
 */
function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Resolve the base path for fetching words_optimized.json.
 * Handles Vite dev server, production with base path, and subpath deployments.
 */
function getWordsJsonUrl() {
  // In production, the JSON is at ./words_optimized.json (same dir as index.html)
  // The Vite config copies it to dist/ and the PWA precaches it.
  // Use import.meta.env.BASE_URL for Vite's configured base path.
  const base = import.meta.env.BASE_URL || './';
  const basePath = base.endsWith('/') ? base : base + '/';
  const url = `${basePath}words_optimized.json`;

  // Version the request URL so dictionary updates invalidate old caches.
  // This is especially important for Korean sentence fixes: without a
  // versioned URL, some installed PWAs can keep serving stale JSON.
  return WORDS_DATA_REVISION ? `${url}?v=${encodeURIComponent(WORDS_DATA_REVISION)}` : url;
}

/**
 * Fetch the canonical public dictionary as text. Keeping the raw text lets us
 * reuse the same response if the Worker is unavailable instead of bundling a
 * second copy of the complete dictionary as a JavaScript fallback chunk.
 */
async function fetchWordsJsonText() {
  const response = await fetch(getWordsJsonUrl());
  if (!response.ok) {
    throw new Error(`Failed to fetch words data: ${response.status}`);
  }
  return response.text();
}

/**
 * Parse and sanitize word data entirely off the main thread.
 */
async function sanitizeViaWorker(jsonText) {
  // NOTE: the URL must be constructed INLINE inside new Worker(...).
  // Vite only recognizes the worker-bundling pattern when new URL() is a
  // direct argument; assigning it to a variable first makes Vite treat
  // data.worker.js as a generic asset, which (being <4 KB) gets inlined as
  // a data: URL — blocked by our CSP `worker-src 'self' blob:` and unable
  // to resolve its './sanitize.js' import anyway. Inlined like this, Vite
  // emits a proper same-origin worker chunk with sanitize.js bundled in.
  const worker = new Worker(new URL('./data.worker.js', import.meta.url), { type: 'module' });

  // Structured clone of the JSON string is fast; parsing happens in the Worker.
  worker.postMessage(jsonText);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker timeout'));
      worker.terminate();
    }, 10000);

    worker.onmessage = (event) => {
      clearTimeout(timeout);
      const result = event.data;
      if (result && result.__error) {
        reject(new Error(result.message || 'Worker error'));
      } else {
        resolve(result);
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      console.error('[Data Worker] Error:', err);
      reject(err);
      worker.terminate();
    };
  });
}

/**
 * Compatibility fallback for browsers where a module Worker cannot start.
 * This may briefly block the main thread, but it reuses the fetched text and
 * avoids shipping another 190+ KB copy of the dictionary in every build.
 */
async function sanitizeOnMainThread(jsonText) {
  await yieldToMain();
  const freshData = JSON.parse(jsonText);
  await yieldToMain();
  return sanitizeToeicData(freshData);
}

/**
 * Load fresh data with full INP-optimized pipeline:
 * fetch → Worker (JSON.parse + sanitize) → result
 */
async function fetchFreshData() {
  try {
    const jsonText = await fetchWordsJsonText();
    let sanitizedData;

    // Primary path: Worker parsing keeps JSON.parse off the main thread.
    try {
      sanitizedData = await sanitizeViaWorker(jsonText);
    } catch (workerErr) {
      // Worker errors are often bare Events (CSP blocks, load failures) with
      // no .message — fall back to a readable description instead of logging
      // a bare "undefined".
      const reason = workerErr?.message || workerErr?.type || workerErr?.name || 'unknown error';
      console.warn('[Data] Worker path failed, parsing fetched data on the main thread:', reason);

      try {
        sanitizedData = await sanitizeOnMainThread(jsonText);
      } catch (parseErr) {
        console.warn('[Data] Main-thread fallback also failed:', parseErr.message);
        return []; // Return empty — app will show error state
      }
    }
    
    // Yield before assigning so browser can process any queued interactions
    await yieldToMain();
    
    gameData = sanitizedData;
    rebuildWordsIndex();

    // DO NOT write to localStorage — the data is already in memory
    // from the fetch/Worker, and writing 243KB to localStorage would
    // create a 50-100ms blocking long task on the main thread.
    // The data will be re-fetched on next page load (cached by SW).

    return gameData;
  } catch (err) {
    console.error('[Data] Load failed:', err);
    if (gameData) return gameData;
    throw err;
  }
}

export async function loadGameData() {
  if (gameData) return gameData;
  if (dataLoadPromise) return dataLoadPromise;

  // No localStorage cache check — the cache was REDUNDANT because:
  // 1. The JSON data is now loaded via fetch() (cached by HTTP/SW)
  // 2. localStorage.getItem + JSON.parse of 243KB was a 100-200ms
  //    blocking operation that caused INP input delay
  // 3. The service worker caches the JSON file for offline use

  // Load fresh data via fetch + Worker pipeline
  dataLoadPromise = fetchFreshData();
  try {
    return await dataLoadPromise;
  } catch (err) {
    console.error('[Data] Fresh data load failed, using empty dataset', err);
    gameData = [];
    return gameData;
  }
}

export function getGameData() {
  return gameData || [];
}

export function getCategories() {
  if (!categoriesCache && gameData) {
    categoriesCache = [...new Set(gameData.map(w => w.category))];
  }
  return categoriesCache || [];
}

function getWordsByCategory(category) {
  if (!gameData) return [];
  if (category === 'All') return gameData;
  return gameData.filter(w => w.category === category);
}

// SM-2 inspired SRS logic
function getWordPriority(word) {
  const now = Date.now();
  const lastSeen = word.lastSeen || 0;
  const mastery = word.mastery || 0;
  const timeSinceLastSeen = now - lastSeen;

  const interval = INTERVALS[mastery] || INTERVALS[5];
  const isDue = timeSinceLastSeen >= interval;

  if (mastery === 0) return 100;
  if (word.incorrectCount > word.correctCount) return 90;
  if (isDue) return 80;
  
  return Math.max(10, 70 - (timeSinceLastSeen / interval) * 60);
}

export function selectWordsForRound(category, roundSize = 10) {
  // Hard-words rounds reuse this helper after CONTINUE / WORD REVIEW.
  // There is no real "Hard" category in the dictionary — those cards are
  // selected by struggle score instead of category name.
  if (category === 'Hard') {
    return selectHardWords(roundSize);
  }
  const words = getWordsByCategory(category);
  if (!words.length) return [];
  if (words.length <= roundSize) return shuffle([...words]);

  const weighted = words
    .map(word => ({ word, priority: getWordPriority(word) }))
    .sort((a, b) => b.priority - a.priority);

  // 70% top-priority (SRS-due / weak), 30% fresh randoms so the user always
  // sees some new material and doesn't get stuck on the same 10 words.
  const topCount = Math.max(1, Math.round(roundSize * 0.7));
  const randCount = roundSize - topCount;

  const topPool = weighted.slice(0, Math.max(topCount * 2, topCount));
  const top = shuffle(topPool).slice(0, topCount).map(w => w.word);

  const topSet = new Set(top.map(w => w.id));
  const restPool = words.filter(w => !topSet.has(w.id));
  const rest = shuffle(restPool).slice(0, randCount);

  return shuffle([...top, ...rest]);
}

/**
 * Fisher-Yates shuffle (in place, returns the same array for convenience).
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Return words the user struggles with: more wrong than right, or seen at
 * least once but mastery still low. Sorted by "how hard" descending.
 */
export function selectHardWords(limit = 10) {
  const words = getGameData();
  if (!words.length) return [];
  const hard = words
    .filter(w => {
      const wrong = w.incorrectCount || 0;
      const right = w.correctCount || 0;
      return wrong > right || (w.lastSeen > 0 && (w.mastery || 0) < 2);
    })
    .sort((a, b) => {
      const scoreA = (a.incorrectCount || 0) - (a.correctCount || 0);
      const scoreB = (b.incorrectCount || 0) - (b.correctCount || 0);
      return scoreB - scoreA;
    })
    .slice(0, limit);
  return shuffle(hard);
}

/**
 * Per-category progress: mastered/total counts. Used by the category grid.
 */
export function getCategoryStats() {
  const stats = {};
  for (const w of getGameData()) {
    const c = w.category || 'General';
    if (!stats[c]) stats[c] = { total: 0, mastered: 0 };
    stats[c].total += 1;
    if ((w.mastery || 0) >= 4) stats[c].mastered += 1;
  }
  return stats;
}

export function updateWordProgress(wordId, isCorrect) {
  // IDs distinguish the same English term used in multiple categories.
  const word = (wordsById && wordsById.get(wordId)) ||
               getGameData().find(w => w.id === wordId);
  if (!word) return;

  const now = Date.now();
  word.lastSeen = now;

  if (isCorrect) {
    word.correctCount = (word.correctCount || 0) + 1;
    word.mastery = Math.min(word.mastery + 1, 5);
  } else {
    word.incorrectCount = (word.incorrectCount || 0) + 1;
    word.mastery = Math.max(word.mastery - 1, 0);
  }
  
  // Trigger stats update in store
  const stats = getProgressStats();
  store.setState({
    masteredCount: stats.mastered
  });
}

export function getProgressStats() {
  const words = getGameData();
  let mastered = 0;
  for (const word of words) {
    if (word.mastery >= 4) mastered++;
  }
  return { mastered, total: words.length };
}

const UNCONFIRMED_MARKER = SANITIZE_UNCONFIRMED;
const KOREAN_PLACEHOLDER_SNIPPET = '실제 사용 사례';

/**
 * True when a Korean string is a real translation, not the unconfirmed
 * sentinel or the auto-generated "{word}의 실제 사용 사례입니다." stub.
 */
export function isUsableKoreanText(text) {
  return typeof text === 'string'
    && text.trim() !== ''
    && text !== UNCONFIRMED_MARKER
    && !text.includes(KOREAN_PLACEHOLDER_SNIPPET);
}

/**
 * Vocabulary translation for the active language.
 * Korean UI never falls back to Russian (and vice versa) — mixing languages
 * in 단어 복습 / WORD REVIEW is the bug this helper exists to prevent.
 */
export function getWordTranslation(word, lang = 'ru') {
  if (!word) return '';
  if (lang === 'ko') {
    return isUsableKoreanText(word.kor) ? word.kor : '';
  }
  return (typeof word.rus === 'string' && word.rus.trim()) ? word.rus : '';
}

/**
 * Example-sentence translation for the active language.
 * Returns { text, usedLang } — usedLang is 'ko' | 'ru' | null.
 */
export function getExampleTranslation(word, lang = 'ru') {
  if (!word) return { text: '', usedLang: null };
  if (lang === 'ko') {
    if (isUsableKoreanText(word.exampleKor)) {
      return { text: word.exampleKor, usedLang: 'ko' };
    }
    return { text: '', usedLang: null };
  }
  if (typeof word.exampleRus === 'string' && word.exampleRus.trim()) {
    return { text: word.exampleRus, usedLang: 'ru' };
  }
  return { text: '', usedLang: null };
}

// Question & Answer Helpers
export function getQuestionWord(word, lang = 'en') {
  if (!word) return { text: '', isEnglish: true };
  const showEnglish = Math.random() < 0.5;

  if (showEnglish || lang === 'en') {
    return { text: word.eng || '', isEnglish: true };
  }
  const translation = getWordTranslation(word, lang);
  if (translation) return { text: translation, isEnglish: false };
  return { text: word.eng || '', isEnglish: true };
}

export function getCorrectTranslation(word, lang = 'en', questionIsEnglish = true) {
  if (!word) return '';
  if (questionIsEnglish) {
    return getWordTranslation(word, lang) || word.eng || '';
  }
  return word.eng;
}

export function generateOptionsForWord(word, lang, questionIsEnglish) {
  const correctVal = getCorrectTranslation(word, lang, questionIsEnglish);
  const allWords = getGameData();

  const normalize = s => (s || '').toLowerCase().trim();
  const wordEng = normalize(word.eng);
  const wordTranslation = normalize(getWordTranslation(word, lang));

  const options = new Set([correctVal]);
  const maxOptions = 4;

  // Safety break
  let attempts = 0;
  while (options.size < maxOptions && attempts < 100) {
    attempts++;
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    // Skip candidates that would create a second "correct" answer:
    // - same English word (e.g. "productive" appears in two categories) or
    // - same translation (e.g. both "convince" and "persuade" = "убеждать"),
    // otherwise reverse-mode questions can show two valid English options
    // and forward-mode questions two valid translations.
    if (normalize(randomWord.eng) === wordEng) continue;
    if (normalize(getWordTranslation(randomWord, lang)) === wordTranslation) continue;
    const translation = getCorrectTranslation(randomWord, lang, questionIsEnglish);
    if (translation && translation !== correctVal) {
      options.add(translation);
    }
  }

  return Array.from(options).sort(() => Math.random() - 0.5);
}
