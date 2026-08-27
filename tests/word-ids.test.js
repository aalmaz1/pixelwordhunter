import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as data from '../data.js';

// The shipped dictionary uses compact single-letter keys (see build_words.py);
// map id back to its long name so the assertions read naturally.
const words = JSON.parse(
  fs.readFileSync('public/words_optimized.json', 'utf8')
).map(w => ({ ...w, id: w.i }));

describe('v3 word identities', () => {
  it('gives every dictionary record a stable unique id', () => {
    expect(words).toHaveLength(600);
    expect(words.every(word => typeof word.id === 'string' && word.id.length > 3)).toBe(true);
    expect(new Set(words.map(word => word.id)).size).toBe(words.length);
  });

  it('tracks repeated English terms independently', () => {
    const records = [
      { id: 'a--book', eng: 'book', category: 'A', rus: 'бронировать', mastery: 0, lastSeen: 0 },
      { id: 'b--book', eng: 'book', category: 'B', rus: 'бронировать', mastery: 0, lastSeen: 0 }
    ];
    data._setGameDataForTests(records);
    data.updateWordProgress('a--book', true);
    expect(records[0].mastery).toBe(1);
    expect(records[1].mastery).toBe(0);
  });

  it('supports rounds shorter than ten', () => {
    const records = Array.from({ length: 3 }, (_, i) => ({
      id: `short-${i}`, eng: `short${i}`, category: 'Short', rus: `слово${i}`, mastery: 0, lastSeen: 0
    }));
    data._setGameDataForTests(records);
    expect(data.selectWordsForRound('Short', 10)).toHaveLength(3);
  });
});
