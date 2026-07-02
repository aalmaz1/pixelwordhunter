/**
 * data.js
 * Word data management, sanitization, and SRS logic
 */

import { store } from './store.js';
import wordsData from './words_optimized.json';

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

// Helper function to get the base path dynamically
function getBasePath() {
  const baseTag = document.querySelector('base');
  let basePath = '/';

  if (baseTag && baseTag.href) {
    const url = new URL(baseTag.href);
    basePath = url.pathname;
  } else if (import.meta.env.BASE_URL) {
    basePath = import.meta.env.BASE_URL;
  }

  if (basePath && !basePath.endsWith('/')) {
    basePath += '/';
  }
  if (basePath && !basePath.startsWith('/')) {
    basePath = `/${basePath}`;
  }
  
  const currentPathname = window.location.pathname;
  const subpathMatch = currentPathname.match(/^\/(.*?)\//);
  if (subpathMatch && subpathMatch[1] && basePath === '/') {
    basePath = `/${subpathMatch[1]}/`;
  }

  return basePath;
}

/**
 * Fetch fresh data with retry logic
 */
async function fetchFreshData() {
  try {
    // Use imported JSON data directly instead of fetch
    const freshData = wordsData;
    
    // Create a new worker
    const worker = new Worker('./data.worker.js');

    // Send raw data to the worker for sanitization
    worker.postMessage(freshData);

    // Wait for the worker to send back the sanitized data
    const sanitizedData = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        resolve(e.data);
        worker.terminate(); // Terminate worker after use
      };
      worker.onerror = (err) => {
        console.error('[Worker] Error:', err);
        reject(err);
        worker.terminate();
      };
    });

    gameData = sanitizedData;
    localStorage.setItem('pixelWordHunter_words_cache', JSON.stringify(sanitizedData));
    
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

  const cached = localStorage.getItem('pixelWordHunter_words_cache');
  if (cached) {
    try {
      gameData = JSON.parse(cached);
      store.setState({ words: gameData, categories: getCategories() });
      // Запускаем обновление кэша в фоновом режиме, не дожидаясь его
      fetchFreshData().catch(err => console.error("Background data fetch failed:", err));
      return gameData; // Сразу возвращаем кэшированные данные
    } catch {
      console.warn('[Data] Cache corrupted');
      // Если кэш поврежден, то придется ждать загрузки
      dataLoadPromise = fetchFreshData();
      try {
        return await dataLoadPromise;
      } catch (err) {
        // If fresh data also fails, return empty array to allow app to continue
        console.error('[Data] Fresh data load failed, using empty dataset');
        gameData = [];
        store.setState({ words: [], categories: [] });
        return gameData;
      }
    }
  }

  // Если кэша нет, то ждем загрузки
  dataLoadPromise = fetchFreshData();
  try {
    return await dataLoadPromise;
  } catch (err) {
    // If fresh data fails, return empty array to allow app to continue
    console.error('[Data] Fresh data load failed, using empty dataset');
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