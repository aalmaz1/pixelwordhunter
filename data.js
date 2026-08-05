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
 * Now the JSON is loaded via fetch() and parsed + sanitized entirely in a
 * Web Worker. The main thread NEVER does JSON.parse(243KB). Total main-
 * thread blocking for data loading: ~5-10ms (structured clone of result).
 */

import { store } from './store.js';

// NO static import of words_optimized.json!
// import wordsData from './words_optimized.json';  ← REMOVED

let gameData = null;
let categoriesCache = null;
let dataLoadPromise = null;

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
 * Schedule a callback during idle time.
 */
function scheduleIdle(callback, options) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(callback, options);
  }
  return setTimeout(callback, 1);
}

/**
 * Sanitize data inline (fallback when both Worker and fetch fail).
 * Only used as last resort — the Worker path is preferred.
 */
function sanitizeDataInline(rawData) {
  if (!Array.isArray(rawData)) return [];
  
  const UNCONFIRMED_MARKER = '미확인';
  
  return rawData.map(rawWord => {
    if (!rawWord || typeof rawWord !== 'object') return null;
    
    const eng = typeof rawWord.eng === 'string' ? rawWord.eng.trim() : '';
    const category = typeof rawWord.category === 'string' ? rawWord.category.trim() : 'General';
    const rus = typeof rawWord.rus === 'string' && rawWord.rus.trim() ? rawWord.rus.trim() : '';
    const kor = typeof rawWord.kor === 'string' && rawWord.kor.trim() ? rawWord.kor.trim() : 
                (typeof rawWord.ko === 'string' && rawWord.ko.trim() ? rawWord.ko.trim() : '');
    const exampleEng = typeof rawWord.exampleEng === 'string' ? rawWord.exampleEng.trim() : '';
    const exampleRus = typeof rawWord.exampleRus === 'string' ? rawWord.exampleRus.trim() : '';
    const exampleKor = typeof rawWord.exampleKor === 'string' && rawWord.exampleKor.trim() ? rawWord.exampleKor.trim() : 
                      (typeof rawWord.exampleKo === 'string' && rawWord.exampleKo.trim() ? rawWord.exampleKo.trim() : '');
    
    if (!eng || (!rus && !kor)) return null;
    
    return {
      eng,
      category,
      rus: rus || 'No translation',
      kor: kor || UNCONFIRMED_MARKER,
      exampleEng,
      exampleRus,
      exampleKor: exampleKor || UNCONFIRMED_MARKER,
      mastery: Number(rawWord.mastery) || 0,
      lastSeen: Number(rawWord.lastSeen) || 0,
      correctCount: Number(rawWord.correctCount) || 0,
      incorrectCount: Number(rawWord.incorrectCount) || 0
    };
  }).filter(Boolean);
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
  return `${basePath}words_optimized.json`;
}

/**
 * Load and sanitize word data entirely OFF the main thread.
 *
 * Strategy:
 * 1. fetch() the JSON file as TEXT (async, zero main-thread blocking)
 * 2. Send the raw text to a Web Worker
 * 3. Worker does JSON.parse() + sanitize (off main thread)
 * 4. Worker sends back sanitized data (structured clone ~5-10ms)
 *
 * This eliminates the 200ms+ JSON.parse(243KB) that was previously
 * embedded in the main JS bundle at module level.
 */
async function loadAndSanitizeViaWorker() {
  const jsonUrl = getWordsJsonUrl();
  
  // Step 1: Fetch JSON as text (completely async, no main-thread blocking)
  const response = await fetch(jsonUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch words data: ${response.status}`);
  }
  const jsonText = await response.text(); // async read, no blocking
  
  // Step 2: Send to Worker for parsing + sanitization
  const workerUrl = new URL('./data.worker.js', import.meta.url);
  const worker = new Worker(workerUrl, { type: 'module' });
  
  // Send the raw JSON string. Worker will JSON.parse + sanitize.
  // Structured clone of a 243KB string is very fast (~0.5ms).
  worker.postMessage(jsonText);
  
  const sanitizedData = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker timeout'));
      worker.terminate();
    }, 10000); // 10s timeout for large data
    
    worker.onmessage = (e) => {
      clearTimeout(timeout);
      const result = e.data;
      
      // Check for Worker-side errors
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
  
  return sanitizedData;
}

/**
 * Fallback: Load via dynamic import (Worker failed but fetch works).
 * The dynamic import still does JSON.parse on the main thread, but
 * it's in a separate chunk so it doesn't block the initial module load.
 */
async function loadViaDynamicImport() {
  const module = await import('./words_optimized.json');
  const freshData = module.default || module;
  await yieldToMain();
  return sanitizeDataInline(freshData);
}

/**
 * Last resort fallback: Load via dynamic import with inline sanitization.
 * Used when both Worker and dynamic import fail.
 */
async function loadWithInlineFallback() {
  try {
    return await loadViaDynamicImport();
  } catch (importErr) {
    console.error('[Data] Dynamic import also failed:', importErr.message);
    return [];
  }
}

/**
 * Load fresh data with full INP-optimized pipeline:
 * fetch → Worker (JSON.parse + sanitize) → result
 */
async function fetchFreshData() {
  try {
    let sanitizedData;
    
    // Primary path: fetch + Worker (zero main-thread blocking for JSON.parse)
    try {
      sanitizedData = await loadAndSanitizeViaWorker();
    } catch (workerErr) {
      console.warn('[Data] Worker path failed, trying dynamic import:', workerErr.message);
      
      // Fallback path: dynamic import (JSON.parse on main thread, but in separate chunk)
      try {
        sanitizedData = await loadViaDynamicImport();
      } catch (importErr) {
        console.warn('[Data] Dynamic import also failed:', importErr.message);
        return []; // Return empty — app will show error state
      }
    }
    
    // Yield before assigning so browser can process any queued interactions
    await yieldToMain();
    
    gameData = sanitizedData;
    
    // DO NOT write to localStorage — the data is already in memory
    // from the fetch/Worker, and writing 243KB to localStorage would
    // create a 50-100ms blocking long task on the main thread.
    // The data will be re-fetched on next page load (cached by SW).
    
    // Update Store
    store.setState({ words: sanitizedData, categories: getCategories() });
    
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
    store.setState({ words: [], categories: [] });
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

export function getWordsByCategory(category) {
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
  const words = getWordsByCategory(category);
  if (!words.length) return [];

  const weightedWords = words.map(word => ({
    word,
    priority: getWordPriority(word)
  }));

  weightedWords.sort((a, b) => b.priority - a.priority);

  // Take top priority words then fill with random ones
  const selected = weightedWords.slice(0, roundSize).map(w => w.word);
  
  // Shuffle the selected words for the round
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected;
}

export function updateWordProgress(wordEng, isCorrect) {
  const word = getGameData().find(w => w.eng === wordEng);
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
    masteredCount: stats.mastered,
    learningCount: stats.learning,
    reviewCount: stats.newWords
  });
}

export function getProgressStats() {
  const words = getGameData();
  const total = words.length;
  let mastered = 0;
  let learning = 0;
  
  for (const word of words) {
    if (word.mastery >= 4) mastered++;
    else if (word.mastery > 0) learning++;
  }
  
  return { mastered, learning, newWords: total - mastered - learning, total };
}

export function getMasteryLevel(word) { return word.mastery || 0; }
export function getMasteryLabel(mastery) {
  const labels = ['NEW', 'LEARNING', 'FAMILIAR', 'GOOD', 'STRONG', 'MASTER'];
  return labels[mastery] || labels[0];
}

const UNCONFIRMED_MARKER = '미확인';

// Question & Answer Helpers
export function getQuestionWord(word, lang = 'en') {
  if (!word) return { text: '', isEnglish: true };
  const showEnglish = Math.random() < 0.5;

  if (showEnglish || lang === 'en') {
    return { text: word.eng || '', isEnglish: true };
  } else {
    if (lang === 'ko' && word.kor && word.kor !== UNCONFIRMED_MARKER) {
      return { text: word.kor, isEnglish: false };
    }
    return { text: word.rus || word.eng, isEnglish: false };
  }
}

export function getCorrectTranslation(word, lang = 'en', questionIsEnglish = true) {
  if (!word) return '';
  if (questionIsEnglish) {
    if (lang === 'ko' && word.kor && word.kor !== UNCONFIRMED_MARKER) return word.kor;
    return word.rus || word.eng;
  }
  return word.eng;
}

export function generateOptionsForWord(word, lang, questionIsEnglish) {
  const correctVal = getCorrectTranslation(word, lang, questionIsEnglish);
  const allWords = getGameData();
  
  const options = new Set([correctVal]);
  const maxOptions = 4;
  
  // Safety break
  let attempts = 0;
  while (options.size < maxOptions && attempts < 100) {
    attempts++;
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    const translation = getCorrectTranslation(randomWord, lang, questionIsEnglish);
    if (translation && translation !== correctVal) {
      options.add(translation);
    }
  }
  
  return Array.from(options).sort(() => Math.random() - 0.5);
}
