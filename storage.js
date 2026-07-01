/**
 * storage.js
 * LocalStorage abstraction and Firestore synchronization
 */

import { getGameData } from './data.js';
// Удаляем прямые импорты Firebase
// import { firebaseAuth, firebaseDb, firebaseAvailable } from './firebase-config.js';
// import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { store } from './store.js';

const STORAGE_KEY = 'pixelWordHunter_save_v2';
const BACKUP_KEY = STORAGE_KEY + '_backup';

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
  if (isAuthenticated && user && firebaseDb && doc && getDoc) {
    try {
      const userRef = doc(firebaseDb, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const serverData = userSnap.data();
        if (serverData.progress && validateSaveData(serverData.progress)) {
          progress = serverData.progress;
          // Cache for offline use
          storageSet(STORAGE_KEY, JSON.stringify(progress));
          
          if (serverData.xp) {
            store.setState({ xp: serverData.xp });
            setUserXP(serverData.xp);
          }
          
          console.log('[Storage] Cloud sync successful');
          return progress;
        }
      }
    } catch {
      console.warn('[Storage] Cloud load failed, using local');
    }
  }

  // 2. Fallback to LocalStorage
  const raw = storageGet(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (validateSaveData(parsed)) {
        console.log('[Storage] Local data loaded');
        return parsed;
      }
    } catch {
      console.error('[Storage] Parse error');
    }
  }

  return {};
}

/**
 * Save progress with atomic LocalStorage + Async Firebase
 * Принимает firebaseDb, doc, setDoc, serverTimestamp как аргументы
 */
export async function saveProgress(firebaseDb, doc, setDoc, serverTimestamp) {
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

  // Local Save
  const newData = JSON.stringify(progress);
  const oldData = storageGet(STORAGE_KEY);
  if (oldData) storageSet(BACKUP_KEY, oldData);
  storageSet(STORAGE_KEY, newData);

  // Firestore Sync (Debounced with module-level timeout)
  const { user, isAuthenticated, xp } = store.getState();
  if (isAuthenticated && user && firebaseDb && doc && setDoc && serverTimestamp) {
    // Use a local timeout variable scoped to this module
    if (saveProgress._timeout) clearTimeout(saveProgress._timeout);
    
    saveProgress._timeout = setTimeout(async () => {
      try {
        await setDoc(doc(firebaseDb, 'users', user.uid), {
          progress,
          xp,
          lastSync: serverTimestamp(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('[Storage] Cloud saved');
        storageRemove(BACKUP_KEY);
      } catch {
        console.warn('[Storage] Cloud save failed');
      }
    }, 2000);
  }
}

/**
 * User-specific XP handling
 */
export function getCurrentUserId() {
  return store.getState().user?.uid || 'guest';
}

export function setUserXP(xp) {
  const userId = getCurrentUserId();
  storageSet(`xp_${userId}`, String(xp || 0));
  store.setState({ xp: Number(xp) || 0 });
}

export function getUserXP() {
  const userId = getCurrentUserId();
  const saved = storageGet(`xp_${userId}`);
  const xp = parseInt(saved, 10) || 0;
  return xp;
}

export function resetProgress() {
  storageRemove(STORAGE_KEY);
  storageRemove(BACKUP_KEY);
  const userId = getCurrentUserId();
  storageRemove(`xp_${userId}`);
  
  getGameData().forEach(w => {
    w.mastery = 0;
    w.lastSeen = 0;
    w.correctCount = 0;
    w.incorrectCount = 0;
  });
  
  store.setState({ xp: 0 });
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
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (data.progress) {
      storageSet(STORAGE_KEY, JSON.stringify(data.progress));
      if (data.xp !== undefined) setUserXP(data.xp);
      alert('Import successful! Reloading...');
      location.reload();
    }
  } catch {
    alert('Invalid backup file');
  }
}