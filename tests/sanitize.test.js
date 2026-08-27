import { describe, it, expect } from 'vitest';
import { sanitizeToeicData, UNCONFIRMED_MARKER } from '../sanitize.js';

describe('sanitizeToeicData', () => {
  it('drops entries missing required fields', () => {
    const out = sanitizeToeicData([
      { eng: 'contract', rus: 'контракт', category: 'Contracts' },
      { eng: '', rus: 'nope' },
      null,
      { eng: 'loan' }, // no translation
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].eng).toBe('contract');
  });

  it('fills defaults for missing progress fields', () => {
    const [w] = sanitizeToeicData([{ eng: 'x', rus: 'икс', category: 'C' }]);
    expect(w.mastery).toBe(0);
    expect(w.correctCount).toBe(0);
    expect(w.incorrectCount).toBe(0);
  });

  it('marks missing Korean with the unconfirmed sentinel', () => {
    const [w] = sanitizeToeicData([{ eng: 'x', rus: 'икс' }]);
    expect(w.kor).toBe(UNCONFIRMED_MARKER);
  });

  it('accepts both `ko` and `kor` aliases', () => {
    const [w] = sanitizeToeicData([{ eng: 'x', ko: '엑스' }]);
    expect(w.kor).toBe('엑스');
  });

  it('accepts the compact single-letter key format used by the shipped JSON', () => {
    const [w] = sanitizeToeicData([
      { i: 'a--x', c: 'A', e: 'x', r: 'икс', E: 'ex', R: 'пр', k: '엑스', K: '예' }
    ]);
    expect(w.id).toBe('a--x');
    expect(w.eng).toBe('x');
    expect(w.category).toBe('A');
    expect(w.rus).toBe('икс');
    expect(w.exampleEng).toBe('ex');
    expect(w.exampleRus).toBe('пр');
    expect(w.kor).toBe('엑스');
    expect(w.exampleKor).toBe('예');
  });

  it('returns [] for non-array input', () => {
    expect(sanitizeToeicData(null)).toEqual([]);
    expect(sanitizeToeicData('nope')).toEqual([]);
    expect(sanitizeToeicData({})).toEqual([]);
  });
});
