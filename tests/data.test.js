import fs from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import * as dataMod from '../data.js';
import { UNCONFIRMED_MARKER } from '../sanitize.js';

const dictionaryPath = 'public/words_optimized.json';

// The shipped dictionary uses compact single-letter keys (see build_words.py);
// map them back to the long names so tests read like the app does.
const SHORT_KEYS = { i: 'id', c: 'category', e: 'eng', r: 'rus', E: 'exampleEng', R: 'exampleRus', k: 'kor', K: 'exampleKor' };

function readDictionary() {
  const raw = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
  return raw.map(w => Object.fromEntries(Object.entries(w).map(([k, v]) => [SHORT_KEYS[k] ?? k, v])));
}

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

  it('always includes due and struggling words when the round has room', () => {
    const words = seed(30);
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    words[0].mastery = 5;
    words[0].lastSeen = old; // due after the seven-day interval
    words[1].incorrectCount = 3;
    words[1].correctCount = 1; // struggling, even if not time-due

    const round = dataMod.selectWordsForRound('A', 10);
    expect(round.map(w => w.eng)).toContain('w0');
    expect(round.map(w => w.eng)).toContain('w1');
  });
});

describe('selectWordsForRound Hard category', () => {
  it('selects struggling words instead of looking up a Hard category', () => {
    const words = seed(20);
    words[0].incorrectCount = 5;
    words[0].correctCount = 1;
    const round = dataMod.selectWordsForRound('Hard', 10);
    expect(round.map(w => w.eng)).toContain('w0');
    expect(round.every(w => w.category === 'A' || w.category === 'B')).toBe(true);
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

describe('long-term mastery intervals', () => {
  it('keeps progressing past one week into long review intervals', () => {
    const words = seed(5);
    const word = words[0];
    for (let i = 0; i < 9; i++) dataMod.updateWordProgress(word.id, true);
    expect(word.mastery).toBe(9);

    // A wrong answer still moves a mature card back one stage.
    dataMod.updateWordProgress(word.id, false);
    expect(word.mastery).toBe(8);
  });
});

describe('getCategoryStats', () => {
  it('counts mastered/total per category', () => {
    const words = seed(10);
    words[0].mastery = 5; // mastered after the stable 7-day stage
    words[1].mastery = 9; // long-term stage
    const stats = dataMod.getCategoryStats();
    expect(stats.A.total).toBe(10); // seeded n=10 all in A because i<15
    expect(stats.A.mastered).toBe(2);
  });
});

describe('vocabulary translations follow the selected language', () => {
  const word = {
    eng: 'backlog',
    rus: 'задолженность',
    kor: '미해결 업무',
    exampleEng: 'A backlog of orders built up quickly.',
    exampleRus: 'Невыполненные заказы накапливались быстро.',
    exampleKor: '미처리 주문이 빠르게 쌓였습니다.',
  };

  it('returns Korean word and sentence when lang is ko — never Russian', () => {
    expect(dataMod.getWordTranslation(word, 'ko')).toBe('미해결 업무');
    expect(dataMod.getExampleTranslation(word, 'ko')).toEqual({
      text: '미처리 주문이 빠르게 쌓였습니다.',
      usedLang: 'ko',
    });
    expect(dataMod.getCorrectTranslation(word, 'ko', true)).toBe('미해결 업무');
  });

  it('returns Russian word and sentence when lang is ru — never Korean', () => {
    expect(dataMod.getWordTranslation(word, 'ru')).toBe('задолженность');
    expect(dataMod.getExampleTranslation(word, 'ru')).toEqual({
      text: 'Невыполненные заказы накапливались быстро.',
      usedLang: 'ru',
    });
    expect(dataMod.getCorrectTranslation(word, 'ru', true)).toBe('задолженность');
  });

  it('does not fall back to Russian for Korean placeholders or unconfirmed text', () => {
    const stub = {
      ...word,
      kor: UNCONFIRMED_MARKER,
      exampleKor: '미해결 업무의 실제 사용 사례입니다.',
    };
    expect(dataMod.isUsableKoreanText(stub.kor)).toBe(false);
    expect(dataMod.isUsableKoreanText(stub.exampleKor)).toBe(false);
    expect(dataMod.getWordTranslation(stub, 'ko')).toBe('');
    expect(dataMod.getExampleTranslation(stub, 'ko')).toEqual({ text: '', usedLang: null });
    expect(dataMod.getExampleTranslation(stub, 'ko').text).not.toMatch(/[А-яЁё]/);
  });
});

describe('word bank Korean examples', () => {
  it('has complete usable Korean translations for every word and example sentence', () => {
    const words = readDictionary();
    const unusableWordTranslations = words
      .filter(w => !dataMod.isUsableKoreanText(w.kor))
      .map(w => w.id);
    const unusableExampleTranslations = words
      .filter(w => !dataMod.isUsableKoreanText(w.exampleKor))
      .map(w => w.id);

    expect(unusableWordTranslations).toEqual([]);
    expect(unusableExampleTranslations).toEqual([]);
  });

  it('stores one complete canonical dictionary in public/', () => {
    const words = readDictionary();
    expect(words).toHaveLength(600);
    expect(words.every(word => word.eng && word.rus && word.kor)).toBe(true);
  });
});

describe('generateOptionsForWord fairness', () => {
  it('never offers a distractor that is also a correct answer (shared translation, reverse mode)', () => {
    // "convince" and "persuade" both translate to «убеждать»: a reverse-mode
    // question showing «убеждать» must not offer both English words.
    const words = [
      { eng: 'convince', category: 'A', rus: 'убеждать', kor: '설득하다' },
      { eng: 'persuade', category: 'A', rus: 'убеждать', kor: '설득하다' },
      { eng: 'offer', category: 'A', rus: 'предлагать', kor: '제안하다' },
      { eng: 'select', category: 'A', rus: 'выбирать', kor: '선택하다' },
      { eng: 'gather', category: 'A', rus: 'собирать', kor: '모으다' },
      { eng: 'attract', category: 'A', rus: 'привлекать', kor: '끌어들이다' }
    ];
    dataMod._setGameDataForTests(words);
    for (let i = 0; i < 300; i++) {
      const opts = dataMod.generateOptionsForWord(words[0], 'ru', false);
      expect(opts).toContain('convince');
      expect(opts).not.toContain('persuade');
    }
  });

  it('never offers the same English word from another category as a distractor (forward mode)', () => {
    // "productive" exists in two categories with slightly different Russian
    // glosses — the other gloss must not appear as a distractor.
    const words = [
      { eng: 'productive', category: 'A', rus: 'продуктивный, результативный', kor: '생산적인' },
      { eng: 'productive', category: 'B', rus: 'продуктивный', kor: '생산적인' },
      { eng: 'offer', category: 'A', rus: 'предлагать', kor: '제안하다' },
      { eng: 'select', category: 'A', rus: 'выбирать', kor: '선택하다' },
      { eng: 'gather', category: 'A', rus: 'собирать', kor: '모으다' },
      { eng: 'attract', category: 'A', rus: 'привлекать', kor: '끌어들이다' }
    ];
    dataMod._setGameDataForTests(words);
    for (let i = 0; i < 300; i++) {
      const opts = dataMod.generateOptionsForWord(words[0], 'ru', true);
      expect(opts).toContain('продуктивный, результативный');
      expect(opts).not.toContain('продуктивный');
    }
  });

  it('still returns 4 unique options when enough safe words exist', () => {
    const words = Array.from({ length: 20 }, (_, i) => ({
      eng: `w${i}`, category: 'A', rus: `слово${i}`, kor: `단어${i}`
    }));
    dataMod._setGameDataForTests(words);
    const opts = dataMod.generateOptionsForWord(words[0], 'ru', true);
    expect(opts.length).toBe(4);
    expect(new Set(opts).size).toBe(4);
  });
});
