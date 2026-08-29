/**
 * storage.js
 * LocalStorage abstraction and Firestore synchronization
 */

import { getGameData, MAX_MASTERY_LEVEL } from './data.js';
import { store } from './store.js';

const LEGACY_STORAGE_KEY = 'pixelWordHunter_save_v2';
const STORAGE_PREFIX = 'pixelWordHunter_save_v3_';

function storageOwner() {
  const user = store.getState().user;
  return user && !user.isAnonymous ? user.uid : 'guest';
}

function progressKey(owner = storageOwner()) {
  return `${STORAGE_PREFIX}${owner}`;
}

function backupKey(owner = storageOwner()) {
  return `${progressKey(owner)}_backup`;
}

/** Convert the old eng-keyed format to the ID-keyed v3 format. Repeated terms
 * inherit the old result so no previously earned progress is lost. */
export function migrateProgress(progress) {
  if (!progress || typeof progress !== 'object') return {};
  const words = getGameData();
  const migrated = {};
  for (const word of words) {
    const value = progress[word.id] || progress[word.eng];
    if (value) migrated[word.id] = { ...value };
  }
  return migrated;
}

export function mergeProgress(a = {}, b = {}) {
  const result = { ...a };
  for (const [id, incoming] of Object.entries(b)) {
    const current = result[id] || {};
    result[id] = {
      mastery: Math.max(current.mastery || 0, incoming.mastery || 0),
      lastSeen: Math.max(current.lastSeen || 0, incoming.lastSeen || 0),
      correctCount: Math.max(current.correctCount || 0, incoming.correctCount || 0),
      incorrectCount: Math.max(current.incorrectCount || 0, incoming.incorrectCount || 0)
    };
  }
  return result;
}

export function getGuestProgress() {
  try {
    return migrateProgress(JSON.parse(storageGet(progressKey('guest')) || '{}'));
  } catch {
    return {};
  }
}

export function getGuestXP() {
  const saved = storageGet('xp_guest');
  return Math.max(0, parseInt(saved, 10) || 0);
}

/**
 * Earlier releases stored anonymous TRY XP under xp_<anonymousUid>. Anonymous
 * learning now consistently uses the guest namespace, so move that local value
 * once without losing XP that may already have been earned before auth resolved.
 */
export function migrateAnonymousXP(userId) {
  if (!userId) return getGuestXP();
  const legacyKey = `xp_${userId}`;
  const legacyXP = Math.max(0, parseInt(storageGet(legacyKey), 10) || 0);
  if (legacyXP > 0) storageSet('xp_guest', String(getGuestXP() + legacyXP));
  storageRemove(legacyKey);
  return getGuestXP();
}

export function clearGuestProgress() {
  storageRemove(progressKey('guest'));
  storageRemove(backupKey('guest'));
  storageRemove('xp_guest');
}

export function persistCurrentProgress(progress) {
  const owner = storageOwner();
  if (owner !== 'guest' && isAccountDeletionSyncBlocked(owner)) return;
  storageSet(progressKey(owner), JSON.stringify(progress));
}

// ==================== INP OPTIMIZATION ====================

/**
 * Schedule a callback during idle time.
 */
function scheduleIdle(callback, options) {
  if (typeof requestIdleCallback === 'function') {
    return { type: 'idle', id: requestIdleCallback(callback, options) };
  }
  return { type: 'timeout', id: setTimeout(callback, 1) };
}

function cancelScheduledIdle(handle) {
  if (!handle) return;
  if (handle.type === 'idle' && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(handle.id);
  } else {
    clearTimeout(handle.id);
  }
}

// Debounce timer for local saves — prevents rapid-fire localStorage writes
// (e.g. from fast answer clicks) from creating consecutive long tasks.
let _localSaveTimer = null;
let _localSaveIdleHandle = null;
const LOCAL_SAVE_DEBOUNCE_MS = 500;

// Account deletion is a destructive, multi-service operation: Firestore user
// data must disappear before the Firebase Auth record goes away, and no late
// debounced save is allowed to recreate the document after deletion.  These
// locks block both local account writes and cloud writes for a uid while the
// delete flow is active.  A persistent marker is set once cloud data removal
// starts, so if the browser reloads midway we still do not recreate the user's
// cloud progress on the next login.
const ACCOUNT_DELETION_PREFIX = 'pixelWordHunter_account_delete_pending_';
const _accountDeletionLocks = new Set();
const _activeCloudWrites = new Map();

function accountDeletionKey(uid) {
  return `${ACCOUNT_DELETION_PREFIX}${uid}`;
}

export function isAccountDeletionSyncBlocked(uid) {
  return !!uid && (
    _accountDeletionLocks.has(uid) || storageGet(accountDeletionKey(uid)) !== null
  );
}

function setPersistentAccountDeletionMarker(uid) {
  if (!uid) return;
  storageSet(accountDeletionKey(uid), String(Date.now()));
}

function clearPersistentAccountDeletionMarker(uid) {
  if (!uid) return;
  storageRemove(accountDeletionKey(uid));
}

function trackAccountCloudWrite(uid, task) {
  if (!uid) return Promise.resolve().then(task);
  let writes = _activeCloudWrites.get(uid);
  if (!writes) {
    writes = new Set();
    _activeCloudWrites.set(uid, writes);
  }

  const tracked = Promise.resolve()
    .then(task)
    .finally(() => {
      writes.delete(tracked);
      if (writes.size === 0) _activeCloudWrites.delete(uid);
    });
  writes.add(tracked);
  return tracked;
}

export async function waitForAccountCloudWrites(uid, timeoutMs = 8000) {
  const writes = Array.from(_activeCloudWrites.get(uid) || []);
  if (writes.length === 0) return true;

  let timeoutId;
  const timeout = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve(false), timeoutMs);
  });
  const settled = Promise.allSettled(writes).then(() => true);
  const result = await Promise.race([settled, timeout]);
  clearTimeout(timeoutId);
  return result === true;
}

function emitSyncStatus(status) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pwh:syncStatus', { detail: { status } }));
  }
}

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
  
  if (Object.keys(data).length > 1000) return false;
  for (const [, progress] of Object.entries(data)) {
    if (!progress || typeof progress !== 'object') return false;
    if (!Number.isFinite(progress.mastery) || progress.mastery < 0 || progress.mastery > MAX_MASTERY_LEVEL) return false;
    if (!Number.isFinite(progress.lastSeen) || progress.lastSeen < 0) return false;
    if (progress.correctCount != null && (!Number.isFinite(progress.correctCount) || progress.correctCount < 0)) return false;
    if (progress.incorrectCount != null && (!Number.isFinite(progress.incorrectCount) || progress.incorrectCount < 0)) return false;
  }
  return true;
}

export function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { console.error('[Storage] Set failed', e); }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * Load progress with Cloud Sync priority
 * Принимает firebaseDb и doc, getDoc как аргументы
 */
export async function loadProgress(firebaseDb, doc, getDoc) {
  const { user, isAuthenticated } = store.getState();
  let progress = {};

  // If a previous deletion was interrupted after cloud data removal began,
  // never reload or recreate account-scoped progress from this client.
  if (isAuthenticated && user && !user.isAnonymous && isAccountDeletionSyncBlocked(user.uid)) {
    return {};
  }

  // 1. Try Firebase if authenticated
  if (isAuthenticated && user && !user.isAnonymous) {
    try {
      const deps = await resolveFirebaseSyncDeps(firebaseDb, doc, getDoc);
      if (deps.firebaseDb && deps.doc && deps.getDoc) {
        const userRef = deps.doc(deps.firebaseDb, 'users', user.uid);
        const userSnap = await deps.getDoc(userRef);

        if (userSnap.exists()) {
          const serverData = userSnap.data();
          if (serverData.progress && validateSaveData(serverData.progress)) {
            progress = migrateProgress(serverData.progress);
            // Cache only in this user's namespace.
            storageSet(progressKey(user.uid), JSON.stringify(progress));
            
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

  // 2. Fallback to this user's local namespace. For guests only, migrate the
  // legacy shared v2 key once; account data is never exposed after logout.
  const owner = user && !user.isAnonymous ? user.uid : 'guest';
  const raw = storageGet(progressKey(owner));
  const legacyRaw = owner === 'guest' ? storageGet(LEGACY_STORAGE_KEY) : null;
  try {
    const parsed = JSON.parse(raw || legacyRaw || '{}');
    if (validateSaveData(parsed)) {
      const migrated = migrateProgress(parsed);
      if (legacyRaw && !raw) {
        storageSet(progressKey('guest'), JSON.stringify(migrated));
        storageRemove(LEGACY_STORAGE_KEY);
      }
      if (import.meta.env.DEV) console.log('[Storage] Local data loaded');
      return migrated;
    }
  } catch {
    console.error('[Storage] Parse error');
  }

  return {};
}

/**
 * Load progress wrapper for backward compatibility (no args)
 */
export async function loadProgressWrapper() {
  return loadProgress();
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
      progress[w.id] = {
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
 * Flush the latest progress synchronously when a tab is backgrounded or
 * closed. Normal answers still use the debounced path below, but a learner
 * should not lose the final answer just because they close the tab quickly.
 */
export function flushLocalProgress() {
  try {
    const owner = storageOwner();
    if (owner !== 'guest' && isAccountDeletionSyncBlocked(owner)) return;
    const progress = buildProgressData();
    const oldData = storageGet(progressKey(owner));
    if (oldData) storageSet(backupKey(owner), oldData);
    storageSet(progressKey(owner), JSON.stringify(progress));
  } catch (error) {
    console.warn('[Storage] Final local save failed:', error.message);
  }
}

/**
 * Write progress to localStorage, debounced to avoid creating
 * consecutive long tasks from rapid answer clicks.
 */
function debouncedLocalSave(progress) {
  const owner = storageOwner();
  if (owner !== 'guest' && isAccountDeletionSyncBlocked(owner)) return;

  if (_localSaveTimer) clearTimeout(_localSaveTimer);
  if (_localSaveIdleHandle) {
    cancelScheduledIdle(_localSaveIdleHandle);
    _localSaveIdleHandle = null;
  }

  _localSaveTimer = setTimeout(() => {
    _localSaveTimer = null;
    // Schedule the actual write during idle to avoid blocking interactions.
    // The owner is captured now so progress from one account can never be
    // written into another account's or the guest namespace after auth changes.
    _localSaveIdleHandle = scheduleIdle(() => {
      _localSaveIdleHandle = null;
      if (owner !== 'guest' && isAccountDeletionSyncBlocked(owner)) return;
      try {
        const newData = JSON.stringify(progress);
        const oldData = storageGet(progressKey(owner));
        if (oldData) storageSet(backupKey(owner), oldData);
        storageSet(progressKey(owner), newData);
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

  // Debounced local save — avoids creating long tasks on every answer.
  debouncedLocalSave(progress);

  // Firestore Sync (Debounced with module-level timeout)
  const { user, isAuthenticated } = store.getState();
  // Note: XP is now synced via atomic increments and real-time listeners
  // so we don't need to explicitly save it here anymore.
  if (isAuthenticated && user && !user.isAnonymous) {
    const userId = user.uid;
    if (isAccountDeletionSyncBlocked(userId)) return;

    emitSyncStatus('syncing');
    const deps = await resolveFirebaseSyncDeps(firebaseDb, doc, undefined, setDoc, serverTimestamp);
    if (deps.firebaseDb && deps.doc && deps.getDoc && deps.setDoc && deps.serverTimestamp) {
      // Use a local timeout variable scoped to this module
      if (saveProgress._timeout) clearTimeout(saveProgress._timeout);

      saveProgress._timeout = setTimeout(async () => {
        saveProgress._timeout = null;
        await trackAccountCloudWrite(userId, async () => {
          if (isAccountDeletionSyncBlocked(userId) || store.getState().user?.uid !== userId) return;
          try {
            const userRef = deps.doc(deps.firebaseDb, 'users', userId);

            // Проверяем существование документа пользователя
            const userSnap = await deps.getDoc(userRef);
            if (isAccountDeletionSyncBlocked(userId) || store.getState().user?.uid !== userId) return;

            if (!userSnap.exists()) {
              // Создаём новый документ с начальными данными
              // Local XP already includes any queued atomic increments. Seed the
              // document with only the pre-delta base so flushPendingXP() can add
              // the queued amount exactly once.
              const baseXP = Math.max(0, getUserXP() - _pendingXpDelta);
              await deps.setDoc(userRef, {
                progress,
                xp: baseXP,
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

            storageRemove(backupKey(userId));
            emitSyncStatus('synced');
          } catch (error) {
            emitSyncStatus('sync_error');
            console.warn('[Storage] Cloud save failed:', error.message);
          }
        });
      }, 2000);
    }
  }
}


/**
 * User-specific XP handling with atomic server increments
 */
function getCurrentUserId() {
  const user = store.getState().user;
  // Anonymous TRY sessions intentionally share the local guest namespace.
  // Only an email account gets a user-specific XP bucket and cloud writes,
  // matching the way card progress is namespaced in storageOwner().
  return user && !user.isAnonymous ? user.uid : null;
}

/**
 * Sets XP locally and persists to localStorage (for offline/guest users)
 * For authenticated users, XP is synced via real-time listener in firebase-config.js
 */
function setUserXP(xp) {
  const userId = getCurrentUserId();
  if (userId && isAccountDeletionSyncBlocked(userId)) return;
  storageSet(`xp_${userId || 'guest'}`, String(xp || 0));
  store.setState({ xp: Number(xp) || 0 });
}

export function getUserXP() {
  const userId = getCurrentUserId();
  if (userId && isAccountDeletionSyncBlocked(userId)) return 0;
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

export function getPendingXpDelta() {
  return _pendingXpDelta;
}

export async function flushPendingXP() {
  if (_pendingXpDelta === 0) return;

  const userId = getCurrentUserId();
  if (!userId || !store.getState().isAuthenticated) {
    // No authenticated account owns this pending delta anymore.  Logout flows
    // explicitly call flush before signOut, so reaching this branch means the
    // delta cannot be safely attributed to an account.
    _pendingXpDelta = 0;
    return;
  }
  if (isAccountDeletionSyncBlocked(userId)) return;

  const delta = _pendingXpDelta;
  _pendingXpDelta = 0;

  try {
    await trackAccountCloudWrite(userId, async () => {
      if (isAccountDeletionSyncBlocked(userId) || store.getState().user?.uid !== userId) {
        _pendingXpDelta += delta;
        return;
      }

      const deps = await resolveFirebaseSyncDeps();
      if (!deps.firebaseDb || !deps.doc || !deps.getDoc || !deps.setDoc || !deps.updateDoc || !deps.increment) {
        _pendingXpDelta += delta;
        return;
      }
      if (isAccountDeletionSyncBlocked(userId) || store.getState().user?.uid !== userId) {
        _pendingXpDelta += delta;
        return;
      }

      const userRef = deps.doc(deps.firebaseDb, 'users', userId);
      const snap = await deps.getDoc(userRef);
      if (isAccountDeletionSyncBlocked(userId) || store.getState().user?.uid !== userId) {
        _pendingXpDelta += delta;
        return;
      }

      if (!snap.exists()) {
        await deps.setDoc(userRef, { xp: 0 });
      }
      await deps.updateDoc(userRef, { xp: deps.increment(delta) });
      if (import.meta.env.DEV) console.log(`[XP] Flushed +${delta} XP for user ${userId}`);
    });
  } catch (error) {
    // Re-queue the delta so we don't lose progress; will retry on next flush.
    _pendingXpDelta += delta;
    console.warn('[XP] Flush failed, re-queued:', error.message);
  }
}


if (typeof window !== 'undefined') {
  const flushBeforeExit = () => {
    flushLocalProgress();
    flushPendingXP();
  };
  window.addEventListener('beforeunload', flushBeforeExit);
  window.addEventListener('pagehide', flushLocalProgress);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLocalProgress();
  });
}

/**
 * Add XP. Local state updates immediately for zero-latency UI; the server
 * write is coalesced across up to 5 seconds so a fast player doesn't spam
 * Firestore with a request per answer.
 */
export async function addXP(points) {
  const userId = getCurrentUserId();
  const currentXP = getUserXP();
  if (userId && isAccountDeletionSyncBlocked(userId)) return currentXP;

  const newXP = currentXP + points;
  setUserXP(newXP);

  if (!userId || !store.getState().isAuthenticated) return newXP;

  _pendingXpDelta += points;
  if (_xpFlushTimer) clearTimeout(_xpFlushTimer);
  _xpFlushTimer = setTimeout(flushPendingXP, XP_FLUSH_INTERVAL_MS);
  return newXP;
}

/**
 * Replace account XP with an explicit trusted local value. Normal gameplay
 * uses atomic increments; an imported backup is the one workflow where an
 * absolute value is intentional. Guest/anonymous sessions remain local.
 */
export async function syncXPToCloud(xp = getUserXP()) {
  const userId = getCurrentUserId();
  if (!userId || !store.getState().isAuthenticated || isAccountDeletionSyncBlocked(userId)) return false;

  try {
    emitSyncStatus('syncing');
    const deps = await resolveFirebaseSyncDeps();
    if (!deps.firebaseDb || !deps.doc || !deps.setDoc) return false;
    const value = Math.min(1_000_000_000, Math.max(0, Math.trunc(Number(xp) || 0)));
    await trackAccountCloudWrite(userId, async () => {
      if (isAccountDeletionSyncBlocked(userId) || store.getState().user?.uid !== userId) return;
      await deps.setDoc(deps.doc(deps.firebaseDb, 'users', userId), { xp: value }, { merge: true });
    });
    emitSyncStatus('synced');
    return true;
  } catch (error) {
    emitSyncStatus('sync_error');
    console.warn('[XP] Backup value cloud sync failed:', error.message);
    return false;
  }
}


/**
 * Cancel every pending debounced local save, cloud save and XP flush so a
 * deleted account cannot be re-created by a late write.
 */
export function cancelPendingSync({ discardPendingXP = true } = {}) {
  if (_localSaveTimer) { clearTimeout(_localSaveTimer); _localSaveTimer = null; }
  if (_localSaveIdleHandle) {
    cancelScheduledIdle(_localSaveIdleHandle);
    _localSaveIdleHandle = null;
  }
  if (saveProgress._timeout) { clearTimeout(saveProgress._timeout); saveProgress._timeout = null; }
  if (_xpFlushTimer) { clearTimeout(_xpFlushTimer); _xpFlushTimer = null; }
  if (discardPendingXP) _pendingXpDelta = 0;
}

export function beginAccountDeletionSync(uid) {
  if (!uid) return;
  _accountDeletionLocks.add(uid);
  cancelPendingSync({ discardPendingXP: false });
}

export function markAccountDeletionCloudRemovalStarted(uid) {
  if (!uid) return;
  _accountDeletionLocks.add(uid);
  setPersistentAccountDeletionMarker(uid);
  cancelPendingSync({ discardPendingXP: false });
}

export function abortAccountDeletionSync(uid) {
  if (!uid) return;
  _accountDeletionLocks.delete(uid);
  clearPersistentAccountDeletionMarker(uid);
  if (_pendingXpDelta > 0 && !_xpFlushTimer) {
    _xpFlushTimer = setTimeout(flushPendingXP, 0);
  }
}

export function sealAccountDeletionAfterCloudRemoval(uid) {
  if (!uid) return;
  _accountDeletionLocks.add(uid);
  setPersistentAccountDeletionMarker(uid);
  cancelPendingSync({ discardPendingXP: true });
  clearAccountData(uid);
}

export function finishAccountDeletionSync(uid) {
  if (!uid) return;
  cancelPendingSync({ discardPendingXP: true });
  clearAccountData(uid);
  _accountDeletionLocks.delete(uid);
  clearPersistentAccountDeletionMarker(uid);
}

/**
 * Remove every localStorage key belonging to a deleted account so no card
 * progress or XP survives the account deletion.
 */
export function clearAccountData(uid) {
  if (!uid) return;
  storageRemove(progressKey(uid));
  storageRemove(backupKey(uid));
  storageRemove(`xp_${uid}`);
}


export async function resetProgress({ cloud = false } = {}) {
  cancelPendingSync();
  storageRemove(progressKey());
  storageRemove(backupKey());
  const userId = getCurrentUserId();
  // Clear both the guest bucket and the current user's, so a logged-out
  // session doesn't leak yesterday's guest XP or vice versa.
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

  store.setState({ xp: 0, dailyStreak: 0, masteredCount: 0 });

  if (cloud && userId && store.getState().isAuthenticated) {
    const deps = await resolveFirebaseSyncDeps();
    if (deps.firebaseDb && deps.doc && deps.setDoc) {
      await deps.setDoc(deps.doc(deps.firebaseDb, 'users', userId), {
        progress: {}, xp: 0, updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  }
}

// Export/Import functionality
export function exportProgress() {
  const data = {
    version: 3,
    xp: getUserXP(),
    progress: buildProgressData(),
    settings: {
      theme: store.getState().theme,
      language: store.getState().uiLanguage,
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
    const progress = migrateProgress(data.progress);
    storageSet(progressKey(), JSON.stringify(progress));
    let importedXP = null;
    if (data.xp !== undefined && Number.isFinite(Number(data.xp))) {
      importedXP = Math.min(1_000_000_000, Math.max(0, Math.trunc(Number(data.xp))));
      // Import is an intentional absolute replacement. Drop any queued gameplay
      // delta so it cannot be applied a second time after the backup value.
      if (_xpFlushTimer) { clearTimeout(_xpFlushTimer); _xpFlushTimer = null; }
      _pendingXpDelta = 0;
      setUserXP(importedXP);
    }

    // Backups have included settings since v3. Return only known values so the
    // application can restore them without allowing arbitrary theme/language
    // strings from an imported file into DOM attributes or resource paths.
    const settings = {};
    const rawSettings = data.settings;
    if (rawSettings && typeof rawSettings === 'object') {
      const validThemes = ['cyberpunk', 'midnight', 'matrix', 'sunset', '3310', 'mono'];
      const validLanguages = ['en', 'ru', 'ko'];
      if (validThemes.includes(rawSettings.theme)) settings.theme = rawSettings.theme;
      if (validLanguages.includes(rawSettings.language)) settings.language = rawSettings.language;
      if (typeof rawSettings.audio === 'boolean') settings.audio = rawSettings.audio;
    }

    return { success: true, progress, settings, xp: importedXP };
  } catch {
    return { success: false, error: 'invalid' };
  }
}