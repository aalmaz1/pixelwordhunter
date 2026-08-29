import { describe, it, expect, vi } from 'vitest';

// storage.js touches localStorage during import (via storageGet).
// Provide a stub before importing.
vi.stubGlobal('localStorage', {
  _s: {},
  getItem(k) { return this._s[k] ?? null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
  clear() { this._s = {}; }
});

const {
  validateSaveData,
  migrateProgress,
  mergeProgress,
  loadProgress,
  flushLocalProgress,
  getGuestXP,
  migrateAnonymousXP,
  clearGuestProgress,
  importProgress,
  addXP,
  cancelPendingSync,
  beginAccountDeletionSync,
  markAccountDeletionCloudRemovalStarted,
  abortAccountDeletionSync,
  finishAccountDeletionSync,
  isAccountDeletionSyncBlocked,
  clearAccountData,
  getPendingXpDelta
} = await import('../storage.js');
const dataModule = await import('../data.js');
const { store } = await import('../store.js');

describe('validateSaveData', () => {
  it('accepts a valid progress map', () => {
    expect(validateSaveData({
      contract: { mastery: 3, lastSeen: 123456 }
    })).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateSaveData(null)).toBe(false);
    expect(validateSaveData('nope')).toBe(false);
    expect(validateSaveData(42)).toBe(false);
  });

  it('accepts long-term mastery levels and rejects values above the maximum', () => {
    expect(validateSaveData({ a: { mastery: 9, lastSeen: 0 } })).toBe(true);
    expect(validateSaveData({ a: { mastery: 10, lastSeen: 0 } })).toBe(false);
  });

  it('rejects entries with bad mastery / lastSeen', () => {
    expect(validateSaveData({ a: { mastery: -1, lastSeen: 0 } })).toBe(false);
    expect(validateSaveData({ a: { mastery: 0, lastSeen: -5 } })).toBe(false);
    expect(validateSaveData({ a: { mastery: 'oops', lastSeen: 0 } })).toBe(false);
  });

  it('migrates a v2 English key to every matching v3 record', () => {
    dataModule._setGameDataForTests([
      { id: 'a--book', eng: 'book' },
      { id: 'b--book', eng: 'book' }
    ]);
    const migrated = migrateProgress({ book: { mastery: 3, lastSeen: 99 } });
    expect(migrated['a--book'].mastery).toBe(3);
    expect(migrated['b--book'].mastery).toBe(3);
  });

  it('merges progress without losing the strongest result', () => {
    const merged = mergeProgress(
      { x: { mastery: 4, lastSeen: 10, correctCount: 2, incorrectCount: 3 } },
      { x: { mastery: 2, lastSeen: 20, correctCount: 5, incorrectCount: 1 } }
    );
    expect(merged.x).toEqual({ mastery: 4, lastSeen: 20, correctCount: 5, incorrectCount: 3 });
  });

  it('flushes the latest progress immediately when leaving the page', () => {
    dataModule._setGameDataForTests([
      { id: 'a--book', eng: 'book', mastery: 2, lastSeen: 123 }
    ]);
    flushLocalProgress();
    const saved = JSON.parse(localStorage.getItem('pixelWordHunter_save_v3_guest'));
    expect(saved['a--book'].mastery).toBe(2);
    expect(saved['a--book'].lastSeen).toBe(123);
  });

  it('keeps anonymous TRY XP in the guest namespace', async () => {
    localStorage.removeItem('xp_guest');
    localStorage.removeItem('xp_anonymous-user');
    store.setUser({ uid: 'anonymous-user', isAnonymous: true });

    await addXP(10);

    expect(getGuestXP()).toBe(10);
    expect(localStorage.getItem('xp_anonymous-user')).toBeNull();
    store.setUser(null);
  });

  it('migrates legacy anonymous XP into existing guest XP exactly once', () => {
    localStorage.setItem('xp_guest', '10');
    localStorage.setItem('xp_old-anonymous', '25');

    expect(migrateAnonymousXP('old-anonymous')).toBe(35);
    expect(localStorage.getItem('xp_old-anonymous')).toBeNull();
    expect(migrateAnonymousXP('old-anonymous')).toBe(35);
  });

  it('clears only the deleted account-scoped storage, not the guest bucket', () => {
    localStorage.setItem('pixelWordHunter_save_v3_uid-123', '{}');
    localStorage.setItem('pixelWordHunter_save_v3_uid-123_backup', '{}');
    localStorage.setItem('xp_uid-123', '99');
    localStorage.setItem('pixelWordHunter_save_v3_guest', '{}');
    localStorage.setItem('xp_guest', '5');

    clearAccountData('uid-123');

    expect(localStorage.getItem('pixelWordHunter_save_v3_uid-123')).toBeNull();
    expect(localStorage.getItem('pixelWordHunter_save_v3_uid-123_backup')).toBeNull();
    expect(localStorage.getItem('xp_uid-123')).toBeNull();
    expect(localStorage.getItem('pixelWordHunter_save_v3_guest')).toBe('{}');
    expect(localStorage.getItem('xp_guest')).toBe('5');
  });

  it('cancelPendingSync clears any pending XP delta without throwing', async () => {
    store.setUser({ uid: 'uid-123', isAnonymous: false });
    await addXP(50);
    expect(getPendingXpDelta()).toBe(50);

    cancelPendingSync();

    expect(getPendingXpDelta()).toBe(0);
    store.setUser(null);
  });

  it('blocks account-scoped local writes during account deletion', async () => {
    const uid = 'delete-lock-user';
    dataModule._setGameDataForTests([
      { id: 'delete-lock--book', eng: 'book', mastery: 3, lastSeen: 123 }
    ]);
    store.setUser({ uid, isAnonymous: false });
    localStorage.removeItem(`pixelWordHunter_save_v3_${uid}`);

    beginAccountDeletionSync(uid);
    flushLocalProgress();

    expect(isAccountDeletionSyncBlocked(uid)).toBe(true);
    expect(localStorage.getItem(`pixelWordHunter_save_v3_${uid}`)).toBeNull();

    finishAccountDeletionSync(uid);
    store.setUser(null);
  });

  it('keeps pending XP while deletion is prepared, then discards it only on finish', async () => {
    const uid = 'delete-pending-xp-user';
    store.setUser({ uid, isAnonymous: false });
    await addXP(25);
    expect(getPendingXpDelta()).toBe(25);

    beginAccountDeletionSync(uid);

    expect(isAccountDeletionSyncBlocked(uid)).toBe(true);
    expect(getPendingXpDelta()).toBe(25);

    finishAccountDeletionSync(uid);

    expect(getPendingXpDelta()).toBe(0);
    expect(isAccountDeletionSyncBlocked(uid)).toBe(false);
    store.setUser(null);
  });

  it('uses a persistent deletion marker only after cloud removal starts', () => {
    const uid = 'delete-marker-user';
    const markerKey = `pixelWordHunter_account_delete_pending_${uid}`;

    beginAccountDeletionSync(uid);
    expect(localStorage.getItem(markerKey)).toBeNull();

    markAccountDeletionCloudRemovalStarted(uid);
    expect(localStorage.getItem(markerKey)).not.toBeNull();
    expect(isAccountDeletionSyncBlocked(uid)).toBe(true);

    abortAccountDeletionSync(uid);
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(isAccountDeletionSyncBlocked(uid)).toBe(false);
  });

  it('does not load account progress while a deletion marker is present', async () => {
    const uid = 'delete-load-block-user';
    localStorage.setItem(`pixelWordHunter_save_v3_${uid}`, JSON.stringify({
      a: { mastery: 4, lastSeen: 10 }
    }));
    store.setUser({ uid, isAnonymous: false });

    markAccountDeletionCloudRemovalStarted(uid);
    const loaded = await loadProgress();

    expect(loaded).toEqual({});

    finishAccountDeletionSync(uid);
    store.setUser(null);
  });

  it('clears guest card progress, backup, and XP together', () => {
    localStorage.setItem('pixelWordHunter_save_v3_guest', '{}');
    localStorage.setItem('pixelWordHunter_save_v3_guest_backup', '{}');
    localStorage.setItem('xp_guest', '30');

    clearGuestProgress();

    expect(localStorage.getItem('pixelWordHunter_save_v3_guest')).toBeNull();
    expect(localStorage.getItem('pixelWordHunter_save_v3_guest_backup')).toBeNull();
    expect(localStorage.getItem('xp_guest')).toBeNull();
  });

  it('returns only validated settings from an imported v3 backup', async () => {
    dataModule._setGameDataForTests([
      { id: 'a--book', eng: 'book', mastery: 0, lastSeen: 0 }
    ]);
    const file = {
      text: async () => JSON.stringify({
        version: 3,
        xp: 42,
        progress: {
          'a--book': { mastery: 3, lastSeen: 123, correctCount: 3, incorrectCount: 0 }
        },
        settings: { theme: 'matrix', language: 'ko', audio: false, unexpected: 'ignored' }
      })
    };

    const result = await importProgress(file);

    expect(result.success).toBe(true);
    expect(result.progress['a--book'].mastery).toBe(3);
    expect(result.settings).toEqual({ theme: 'matrix', language: 'ko', audio: false });
    expect(result.xp).toBe(42);
    expect(getGuestXP()).toBe(42);
  });

  it('ignores unknown theme and language values in imported settings', async () => {
    dataModule._setGameDataForTests([
      { id: 'a--book', eng: 'book', mastery: 0, lastSeen: 0 }
    ]);
    const file = {
      text: async () => JSON.stringify({
        progress: {
          'a--book': { mastery: 1, lastSeen: 1 }
        },
        settings: { theme: 'javascript:bad', language: '../bad', audio: 'yes' }
      })
    };

    const result = await importProgress(file);

    expect(result.success).toBe(true);
    expect(result.settings).toEqual({});
  });
});
