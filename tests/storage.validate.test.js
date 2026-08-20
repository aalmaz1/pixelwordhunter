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

const { validateSaveData, migrateProgress, mergeProgress } = await import('../storage.js');
const dataModule = await import('../data.js');

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
});
