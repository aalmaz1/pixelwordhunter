/**
 * storage.js
 * LocalStorage abstraction and Firestore synchronization
 */

import { getGameData } from './data.js';
import { firebaseDb, firebaseAuth } from './firebase-config.js';
import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
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
          
          // Загружаем XP с сервера и сохраняем локально
          if (serverData.xp !== undefined) {
            const serverXP = Number(serverData.xp) || 0;
            storageSet(`xp_${user.uid}`, String(serverXP));
            store.setState({ xp: serverXP });
            console.log(`[Storage] XP loaded from server: ${serverXP}`);
          }
          
          console.log('[Storage] Cloud sync successful');
          return progress;
        }
      } else {
        // Документ не существует - создадим пустой при первом сохранении
        console.log('[Storage] No user document found, will create on first save');
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
 * Load progress wrapper for backward compatibility (no args)
 */
export async function loadProgressWrapper() {
  const state = store.getState();
  const firebaseDb = state.firebaseDb || window.firebaseDb;
  const doc = window.doc;
  const getDoc = window.getDoc;
  return loadProgress(firebaseDb, doc, getDoc);
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
  // Note: XP is now synced via atomic increments and real-time listeners
  // so we don't need to explicitly save it here anymore
  if (isAuthenticated && user && firebaseDb && doc && setDoc && serverTimestamp) {
    // Use a local timeout variable scoped to this module
    if (saveProgress._timeout) clearTimeout(saveProgress._timeout);
    
    saveProgress._timeout = setTimeout(async () => {
      try {
        const userRef = doc(firebaseDb, 'users', user.uid);
        
        // Проверяем существование документа пользователя
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          // Создаём новый документ с начальными данными
          await setDoc(userRef, {
            progress,
            xp: xp || 0,
            lastSync: serverTimestamp(),
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          }, { merge: true });
          console.log('[Storage] New user document created in Firestore');
        } else {
          // Обновляем существующий документ
          await setDoc(userRef, {
            progress,
            lastSync: serverTimestamp(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
          console.log('[Storage] Cloud saved');
        }
        
        storageRemove(BACKUP_KEY);
      } catch (error) {
        console.warn('[Storage] Cloud save failed:', error.message);
      }
    }, 2000);
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

/**
 * Adds XP using atomic server-side increment to prevent race conditions
 * This ensures XP updates are consistent across multiple tabs/devices
 */
export async function addXP(points) {
  const userId = getCurrentUserId();
  
  if (!userId || !firebaseDb) {
    // Offline or guest mode - update locally only
    const currentXP = getUserXP();
    const newXP = currentXP + points;
    setUserXP(newXP);
    return newXP;
  }
  
  try {
    const userRef = doc(firebaseDb, 'users', userId);
    // Check if document exists, if not create it first
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, { xp: 0 });
    }
    // Use atomic increment on server to prevent race conditions
    await updateDoc(userRef, {
      xp: increment(points)
    });
    console.log(`[XP] Added ${points} XP atomically for user ${userId}`);
    // Note: The real-time listener in firebase-config.js will update local state
    return getUserXP() + points;
  } catch (error) {
    console.error('[XP] Failed to add XP:', error);
    // Fallback to local update
    const currentXP = getUserXP();
    const newXP = currentXP + points;
    setUserXP(newXP);
    return newXP;
  }
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