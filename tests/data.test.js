import { describe, it, expect, beforeEach } from 'vitest';
import * as dataMod from '../data.js';

function seed(n = 30) {
  const words = Array.from({ length: n }, (_, i) => ({
    eng: `w${i}`,
    category: i < 15 ? 'A' : 'B',
    rus: `слово${i}`,
    kor: '미확인',
    mastery: 0,
    lastSeen: 0,
    correctCount: 0,
    incorrectCount: 0
  }));
  dataMod._setGameDataForTests(words);
  return words;
}

describe('selectWordsForRound', () => {
  beforeEach(() => seed(30));

  it('returns roundSize words (or fewer when the pool is small)', () => {
    const round = dataMod.selectWordsForRound('All', 10);
    expect(round.length).toBeLessThanOrEqual(10);
  });

  it('does not always return the same top-N words on repeat calls', () => {
    seed(40);
    const sets = [];
    for (let i = 0; i < 6; i++) {
      const r = dataMod.selectWordsForRound('All', 10).map(w => w.eng).sort().join(',');
      sets.push(r);
    }
    expect(new Set(sets).size).toBeGreaterThan(1);
  });
});

describe('selectHardWords', () => {
  it('returns only words that are hard (more wrong than right, or seen-low-mastery)', () => {
    const words = seed(20);
    words[0].incorrectCount = 5; words[0].correctCount = 1;
    words[1].lastSeen = 1;       words[1].mastery = 0;
    words[2].correctCount = 10;  words[2].mastery = 5;
    const engs = dataMod.selectHardWords(10).map(w => w.eng);
    expect(engs).toContain('w0');
    expect(engs).toContain('w1');
    expect(engs).not.toContain('w2');
  });
});

describe('updateWordProgress', () => {
  it('bumps mastery on correct, clamps to 0 on wrong', () => {
    const words = seed(5);
    const w = words[0];
    dataMod.updateWordProgress(w.id, true);
    expect(w.mastery).toBe(1);
    expect(w.correctCount).toBe(1);
    dataMod.updateWordProgress(w.id, false);
    expect(w.mastery).toBe(0);
    expect(w.incorrectCount).toBe(1);
    dataMod.updateWordProgress(w.id, false);
    expect(w.mastery).toBe(0);
  });
});

describe('getCategoryStats', () => {
  it('counts mastered/total per category', () => {
    const words = seed(10);
    words[0].mastery = 4; // mastered
    words[1].mastery = 5;
    const stats = dataMod.getCategoryStats();
    expect(stats.A.total).toBe(10); // seeded n=10 all in A because i<15
    expect(stats.A.mastered).toBe(2);
  });
});
