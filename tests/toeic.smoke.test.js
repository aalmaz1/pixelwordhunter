// @vitest-environment jsdom
/**
 * Smoke test for the TOEIC TESTS mode: mode chooser → test list → test run →
 * result modal. Boots the real app.js against index.html with mocked
 * i18n/data/toeic bank (mirrors tests/app.smoke.test.js plus vi.mock('../toeic.js')).
 * Also asserts the shipped question bank stays consistent (9x100, valid answers).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('../i18n.js', () => ({
  I18nManager: {
    init: async () => {},
    // Mirrors the English table closely enough for the smoke test: the
    // category screen renders its "All" filter through the i18n lookup.
    t: (key) => ({ all_categories: 'All' }[key] ?? key),
    getCurrentLanguage: () => 'en',
    setLanguage: async () => {},
  },
}));

vi.mock('../data.js', () => {
  const words = [
    { id: 'w1', eng: 'guarantee', trans: 'гарантия', category: 'Tech' },
  ];
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  return {
    loadGameData: async () => words,
    getGameData: () => words,
    getCategories: () => ['Tech'],
    getCategoryStats: () => ({ Tech: { mastered: 0, total: 1 } }),
    selectWordsForRound: () => [byId.w1],
    selectHardWords: () => [],
    generateOptionsForWord: (word) => [word.trans, 'wrong option'],
    updateWordProgress: vi.fn(),
    getProgressStats: () => ({ mastered: 0, total: 1 }),
    getCorrectTranslation: (word) => word.trans,
    getQuestionWord: (word) => ({ text: word.eng, isEnglish: true }),
    getWordTranslation: (word) => word.trans,
    getExampleTranslation: () => ({ text: '', usedLang: 'ru' }),
    setWordsIndex: vi.fn(),
  };
});

// Small deterministic stand-in for the real 900-question bank.
vi.mock('../toeic.js', () => ({
  TOEIC_DATA: {
    categories: [
      { id: 1, name: 'Incomplete Sentences Part 1' },
      { id: 2, name: 'Grammar Part 1' },
    ],
    questions: [
      { id: 1, type_id: 1, category: 'Incomplete Sentences Part 1', question: 'Fill the ____', options: ['gap', 'hole', 'space', 'void'], correct: 'gap' },
      { id: 2, type_id: 1, category: 'Incomplete Sentences Part 1', question: 'Choose ____', options: ['alpha', 'beta', 'gamma', 'delta'], correct: 'beta' },
      { id: 3, type_id: 2, category: 'Grammar Part 1', question: 'He ____ home.', options: ['go', 'goes', 'going', 'gone'], correct: 'goes' },
    ],
  },
}));

const $ = (id) => document.getElementById(id);
const hidden = (id) => $(id).classList.contains('hidden');
const waitFor = async (fn, ms = 4000) => {
  const start = Date.now();
  for (;;) {
    try { await fn(); return; } catch (e) {
      if (Date.now() - start > ms) throw e;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
};
const options = () => [...$('toeic-options').querySelectorAll('.option-btn')];
const optionByText = (text) => options().find((b) => b.textContent.includes(text));

beforeAll(() => {
  localStorage.clear();
  const html = fs.readFileSync(process.cwd() + '/index.html', 'utf8');
  document.documentElement.innerHTML = html.replace(/<\/?html[^>]*>/gi, '');
});

it('runs a full TOEIC test through the real UI', async () => {
  await import('../app.js');

  // Boot to menu, then HUNT opens the mode chooser.
  await waitFor(() => expect($('category-list').children.length).toBe(2)); // All + Tech
  expect(hidden('menu-screen')).toBe(false);
  $('hunt-btn').click();
  expect(hidden('mode-screen')).toBe(false);

  // TOEIC TESTS → test list with both parts and question counts.
  $('mode-toeic-btn').click();
  await waitFor(() => expect($('toeic-list').children.length).toBe(2));
  expect(hidden('toeic-screen')).toBe(false);
  expect($('toeic-list').children[0].textContent).toContain('Incomplete Sentences Part 1');
  expect($('toeic-list').children[0].textContent).toContain('2');
  expect($('toeic-list').children[1].textContent).toContain('1'); // 1 question in part 2

  // Start part 1 → question 1 of 2.
  $('toeic-list').children[0].click();
  expect(hidden('toeicgame-screen')).toBe(false);
  expect($('toeic-category').textContent).toBe('Incomplete Sentences Part 1');
  expect($('toeic-question').textContent).toBe('1. Fill the ____');
  expect($('toeic-progress-text').textContent).toBe('1 / 2');
  expect(options().length).toBe(4);
  expect($('toeic-prev-btn').style.visibility).toBe('hidden');

  // Correct answer on Q1 → +2 XP, option marked correct, all locked.
  optionByText('gap').click();
  await waitFor(async () => {
    const { store } = await import('../store.js');
    expect(store.getState().xp).toBe(2);
  });
  expect(optionByText('gap').classList.contains('correct')).toBe(true);
  expect(options().every((b) => b.disabled)).toBe(true);

  // NEXT → Q2, answered wrong → right option is revealed.
  $('toeic-next-btn').click();
  expect($('toeic-question').textContent).toBe('2. Choose ____');
  expect($('toeic-prev-btn').style.visibility).toBe('visible');
  expect($('toeic-next-btn').textContent).toBe('finish'); // last question
  optionByText('gamma').click();
  expect(optionByText('gamma').classList.contains('wrong')).toBe(true);
  expect(optionByText('beta').classList.contains('correct')).toBe(true);

  // PREV returns to the answered Q1 (still locked with the verdict shown).
  $('toeic-prev-btn').click();
  expect($('toeic-question').textContent).toBe('1. Fill the ____');
  expect(optionByText('gap').classList.contains('correct')).toBe(true);
  $('toeic-next-btn').click();

  // FINISH → result modal: 1 of 2 correct, 50%, 2 XP earned.
  $('toeic-next-btn').click();
  await waitFor(() => expect(hidden('toeic-result-modal')).toBe(false));
  const summary = $('toeic-result-summary').textContent;
  expect(summary).toContain('correct_count: 1');
  expect(summary).toContain('wrong_count: 1');
  expect(summary).toContain('accuracy: 50%');
  expect(summary).toContain('xp_earned: 2');

  // RETRY restarts the same test fresh (options unlocked again).
  $('toeic-result-retry-btn').click();
  expect(hidden('toeic-result-modal')).toBe(true);
  expect($('toeic-question').textContent).toBe('1. Fill the ____');
  expect(options().some((b) => !b.disabled)).toBe(true);

  // FINISH again → CHOOSE TEST → back at the test list → EXIT to menu.
  $('toeic-next-btn').click();
  $('toeic-next-btn').click();
  await waitFor(() => expect(hidden('toeic-result-modal')).toBe(false));
  $('toeic-result-tests-btn').click();
  expect(hidden('toeic-screen')).toBe(false);
  $('toeic-back-btn').click();
  expect(hidden('mode-screen')).toBe(false);
});

describe('shipped TOEIC question bank', () => {
  it('stays consistent: 9 parts x 100 unique questions, answers inside options', async () => {
    const bank = JSON.parse(fs.readFileSync(process.cwd() + '/toeic_web_app/toeic_database.json', 'utf8'));
    expect(bank.categories.length).toBe(9);
    expect(bank.questions.length).toBe(900);
    const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const keys = new Set();
    for (const q of bank.questions) {
      expect(q.options).toContain(q.correct);
      keys.add(`${q.type_id}|${norm(q.question)}|${q.options.map(norm).sort().join('|')}`);
    }
    expect(keys.size).toBe(900);
    const counts = new Map();
    for (const q of bank.questions) counts.set(q.type_id, (counts.get(q.type_id) || 0) + 1);
    for (const cat of bank.categories) expect(counts.get(cat.id)).toBe(100);
  });
});
