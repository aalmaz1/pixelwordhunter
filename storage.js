/**
 * storage.js
 * LocalStorage abstraction and Firestore synchronization
 */

import { getGameData } from './data.js';
import { store } from './store.js';

const STORAGE_KEY = 'pixelWordHunter_save_v2';
const BACKUP_KEY = STORAGE_KEY + '_backup';

// ==================== INP OPTIMIZATION ====================

/**
 * Yield to the browser to break long tasks and reduce INP input delay.
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

// Debounce timer for local saves — prevents rapid-fire localStorage writes
// (e.g. from fast answer clicks) from creating consecutive long tasks.
let _localSaveTimer = null;
const LOCAL_SAVE_DEBOUNCE_MS = 500;

async function resolveFirebaseSyncDeps(firebaseDbArg, docArg, getDocArg, setDocArg, serverTimestampArg, updateDocArg, incrementArg) {
  if (firebaseDbArg && docArg && getDocArg && setDocArg) {
    return {
      firebaseDb: firebaseDbArg,
      doc: docArg,
      getDoc: getDocArg,
      setDoc: setDocArg,
      serverTimestamp: serverTimestampArg,
      updateDoc: updateDocArg,
      increment: incrementArg
    };
  }

  const state = store.getState();
  if (!state.isAuthenticated || !state.user) {
    return {};
  }

  const [{ initFirebase, firebaseDb: configuredDb }, firestoreModule] = await Promise.all([
    import('./firebase-config.js'),
    import('firebase/firestore')
  ]);

  await initFirebase();

  return {
    firebaseDb: firebaseDbArg || configuredDb,
    doc: docArg || firestoreModule.doc,
    getDoc: getDocArg || firestoreModule.getDoc,
    setDoc: setDocArg || firestoreModule.setDoc,
    serverTimestamp: serverTimestampArg || firestoreModule.serverTimestamp,
    updateDoc: updateDocArg || firestoreModule.updateDoc,
    increment: incrementArg || firestoreModule.increment
  };
}

/**
 * Data Validation Schema
 */
export function validateSaveData(data) {
  if (!data || typeof data !== 'object') return false;
  
  for (const [, progress] of Object.entries(data)) {
    if (typeof progress.mastery !== 'number' || progress.mastery < 0) return false;
    if (typeof progress.lastSeen !== 'number' || progress.lastSeen < 0) return false;
  }
  return true;
}

export function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { console.error('[Storage] Set failed', e); }
}

export function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * Load progress with Cloud Sync priority
 * Принимает firebaseDb и doc, getDoc как аргументы
 */
export async function loadProgress(firebaseDb, doc, getDoc) {
  const { user, isAuthenticated } = store.getState();
  let progress = {};

  // 1. Try Firebase if authenticated
  if (isAuthenticated && user) {
    try {
      const deps = await resolveFirebaseSyncDeps(firebaseDb, doc, getDoc);
      if (deps.firebaseDb && deps.doc && deps.getDoc) {
        const userRef = deps.doc(deps.firebaseDb, 'users', user.uid);
        const userSnap = await deps.getDoc(userRef);

        if (userSnap.exists()) {
          const serverData = userSnap.data();
          if (serverData.progress && validateSaveData(serverData.progress)) {
            progress = serverData.progress;
            // Cache for offline use
            storageSet(STORAGE_KEY, JSON.stringify(progress));
            
            // Загружаем XP с сервера и сохраняем локально
            if (serverData.xp !== undefined) {
              const serverXP = Number(serverData.xp) || 0;
              storageSet(`xp_${user.uid}`, String(serverXP));
              store.setState({ xp: serverXP });
              if (import.meta.env.DEV) console.log(`[Storage] XP loaded from server: ${serverXP}`);
            }
            
            if (import.meta.env.DEV) console.log('[Storage] Cloud sync successful');
            return progress;
          }
        } else {
          // Документ не существует - создадим пустой при первом сохранении
          if (import.meta.env.DEV) console.log('[Storage] No user document found, will create on first save');
        }
      }
    } catch (error) {
      console.warn('[Storage] Cloud load failed, using local:', error.message);
    }
  }

  // 2. Fallback to LocalStorage
  const raw = storageGet(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (validateSaveData(parsed)) {
        if (import.meta.env.DEV) console.log('[Storage] Local data loaded');
        return parsed;
      }
    } catch {
      console.error('[Storage] Parse error');
    }
  }

  return {};
}

/**
 * Load progress wrapper for backward compatibility (no args)
 */
export async function loadProgressWrapper() {
  const state = store.getState();
  return loadProgress(state.firebaseDb || window.firebaseDb, window.doc, window.getDoc);
}

/**
 * Build the progress object from game data.
 * Separated out so we can build it synchronously but write it
 * to localStorage asynchronously (debounced / idle-scheduled).
 */
function buildProgressData() {
  const words = getGameData();
  const progress = {};
  words.forEach((w) => {
    if (w.mastery > 0 || w.lastSeen > 0) {
      progress[w.eng] = {
        mastery: w.mastery,
        lastSeen: w.lastSeen,
        correctCount: w.correctCount || 0,
        incorrectCount: w.incorrectCount || 0
      };
    }
  });
  return progress;
}

/**
 * Write progress to localStorage, debounced to avoid creating
 * consecutive long tasks from rapid answer clicks.
 */
function debouncedLocalSave(progress) {
  if (_localSaveTimer) clearTimeout(_localSaveTimer);
  _localSaveTimer = setTimeout(() => {
    // Schedule the actual write during idle to avoid blocking interactions
    scheduleIdle(() => {
      try {
        const newData = JSON.stringify(progress);
        const oldData = storageGet(STORAGE_KEY);
        if (oldData) storageSet(BACKUP_KEY, oldData);
        storageSet(STORAGE_KEY, newData);
      } catch (e) {
        console.warn('[Storage] Local save failed:', e.message);
      }
    }, { timeout: LOCAL_SAVE_DEBOUNCE_MS });
  }, LOCAL_SAVE_DEBOUNCE_MS);
}

/**
 * Save progress with atomic LocalStorage + Async Firebase.
 * Local save is debounced and idle-scheduled to avoid blocking
 * the main thread with large JSON.stringify + localStorage.setItem.
 * Принимает firebaseDb, doc, setDoc, serverTimestamp как аргументы
 */
export async function saveProgress(firebaseDb, doc, setDoc, serverTimestamp) {
  const progress = buildProgressData();

  // Debounced local save — avoids creating long tasks on every answer
  debouncedLocalSave(progress);

  // Firestore Sync (Debounced with module-level timeout)
  const { user, isAuthenticated, xp } = store.getState();
  // Note: XP is now synced via atomic increments and real-time listeners
  // so we don't need to explicitly save it here anymore
  if (isAuthenticated && user) {
    const deps = await resolveFirebaseSyncDeps(firebaseDb, doc, undefined, setDoc, serverTimestamp);
    if (deps.firebaseDb && deps.doc && deps.getDoc && deps.setDoc && deps.serverTimestamp) {
      // Use a local timeout variable scoped to this module
      if (saveProgress._timeout) clearTimeout(saveProgress._timeout);
      
      saveProgress._timeout = setTimeout(async () => {
        try {
          const userRef = deps.doc(deps.firebaseDb, 'users', user.uid);
          
          // Проверяем существование документа пользователя
          const userSnap = await deps.getDoc(userRef);
          
          if (!userSnap.exists()) {
            // Создаём новый документ с начальными данными
            await deps.setDoc(userRef, {
              progress,
              xp: xp || 0,
              lastSync: deps.serverTimestamp(),
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString()
            }, { merge: true });
            if (import.meta.env.DEV) console.log('[Storage] New user document created in Firestore');
          } else {
            // Обновляем существующий документ
            await deps.setDoc(userRef, {
              progress,
              lastSync: deps.serverTimestamp(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
            if (import.meta.env.DEV) console.log('[Storage] Cloud saved');
          }
          
          storageRemove(BACKUP_KEY);
        } catch (error) {
          console.warn('[Storage] Cloud save failed:', error.message);
        }
      }, 2000);
    }
  }
}

/**
 * User-specific XP handling with atomic server increments
 */
export function getCurrentUserId() {
  const state = store.getState();
  return state.user?.uid || null;
}

/**
 * Sets XP locally and persists to localStorage (for offline/guest users)
 * For authenticated users, XP is synced via real-time listener in firebase-config.js
 */
export function setUserXP(xp) {
  const userId = getCurrentUserId();
  storageSet(`xp_${userId || 'guest'}`, String(xp || 0));
  store.setState({ xp: Number(xp) || 0 });
}

export function getUserXP() {
  const userId = getCurrentUserId();
  const saved = storageGet(`xp_${userId || 'guest'}`);
  const xp = parseInt(saved, 10) || 0;
  return xp;
}

// ---- Batched XP writes ------------------------------------------------------
// Previous implementation fired 1–2 Firestore requests on EVERY correct answer
// (up to ~10× per round). We now accumulate deltas locally and flush at most
// once every FLUSH_INTERVAL_MS, plus a final flush on beforeunload / logout.

const XP_FLUSH_INTERVAL_MS = 5000;
let _pendingXpDelta = 0;
let _xpFlushTimer = null;

async function flushPendingXP() {
  if (_pendingXpDelta === 0) return;
  const delta = _pendingXpDelta;
  _pendingXpDelta = 0;
  const userId = getCurrentUserId();
  if (!userId || !store.getState().isAuthenticated) return;
  try {
    const deps = await resolveFirebaseSyncDeps();
    if (!deps.firebaseDb || !deps.doc || !deps.getDoc || !deps.updateDoc || !deps.increment) return;
    const userRef = deps.doc(deps.firebaseDb, 'users', userId);
    const snap = await deps.getDoc(userRef);
    if (!snap.exists()) {
      await deps.setDoc(userRef, { xp: 0 });
    }
    await deps.updateDoc(userRef, { xp: deps.increment(delta) });
    if (import.meta.env.DEV) console.log(`[XP] Flushed +${delta} XP for user ${userId}`);
  } catch (error) {
    // Re-queue the delta so we don't lose progress; will retry on next flush.
    _pendingXpDelta += delta;
    console.warn('[XP] Flush failed, re-queued:', error.message);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { flushPendingXP(); });
}

/**
 * Add XP. Local state updates immediately for zero-latency UI; the server
 * write is coalesced across up to 5 seconds so a fast player doesn't spam
 * Firestore with a request per answer.
 */
export async function addXP(points) {
  const currentXP = getUserXP();
  const newXP = currentXP + points;
  setUserXP(newXP);

  const userId = getCurrentUserId();
  if (!userId || !store.getState().isAuthenticated) return newXP;

  _pendingXpDelta += points;
  if (_xpFlushTimer) clearTimeout(_xpFlushTimer);
  _xpFlushTimer = setTimeout(flushPendingXP, XP_FLUSH_INTERVAL_MS);
  return newXP;
}

export function resetProgress() {
  storageRemove(STORAGE_KEY);
  storageRemove(BACKUP_KEY);
  const userId = getCurrentUserId();
  storageRemove(`xp_${userId || 'guest'}`);
  // Also clear the "other" bucket so a logged-out session doesn't leak
  // yesterday's guest XP or vice versa.
  storageRemove('xp_guest');
  if (userId) storageRemove(`xp_${userId}`);
  // Streak data
  storageRemove('pwh_streak');
  storageRemove('pwh_lastPlayed');

  getGameData().forEach(w => {
    w.mastery = 0;
    w.lastSeen = 0;
    w.correctCount = 0;
    w.incorrectCount = 0;
  });

  store.setState({ xp: 0, dailyStreak: 0 });
}

// Export/Import functionality
export function exportProgress() {
  const data = {
    version: 2,
    xp: getUserXP(),
    progress: JSON.parse(storageGet(STORAGE_KEY) || '{}'),
    settings: {
      theme: store.getState().theme,
      language: store.getState().language,
      audio: store.getState().audioEnabled
    }
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pwh-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importProgress(file) {
  if (!file) return { success: false, error: 'no_file' };
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || !data.progress) {
      return { success: false, error: 'invalid' };
    }
    if (!validateSaveData(data.progress)) {
      return { success: false, error: 'invalid' };
    }
    storageSet(STORAGE_KEY, JSON.stringify(data.progress));
    if (data.xp !== undefined) setUserXP(data.xp);
    return { success: true, progress: data.progress };
  } catch {
    return { success: false, error: 'invalid' };
  }
}