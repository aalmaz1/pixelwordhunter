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

  it('returns [] for non-array input', () => {
    expect(sanitizeToeicData(null)).toEqual([]);
    expect(sanitizeToeicData('nope')).toEqual([]);
    expect(sanitizeToeicData({})).toEqual([]);
  });
});
