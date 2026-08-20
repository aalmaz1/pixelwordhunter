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

const { validateSaveData } = await import('../storage.js');

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
});
