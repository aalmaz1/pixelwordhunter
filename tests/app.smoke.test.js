// @vitest-environment jsdom
/**
 * Integration smoke test for the main entry (app.js): boots the app against
 * index.html with mocked i18n/data, then drives a full round of play through
 * the real UI wiring. Guards the refactor of app.js (behavior must not change).
 */
import { beforeAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('../i18n.js', () => ({
  I18nManager: {
    init: async () => {},
    t: (key) => key,
    getCurrentLanguage: () => 'en',
    setLanguage: async () => {},
  },
}));

vi.mock('../data.js', () => {
  const words = [
    { id: 'w1', eng: 'guarantee', trans: 'гарантия', category: 'Tech' },
    { id: 'w2', eng: 'invoice', trans: 'счёт-фактура', category: 'Tech' },
    { id: 'w3', eng: 'freight', trans: 'фрахт', category: 'Logistics' },
  ];
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  return {
    loadGameData: async () => words,
    getGameData: () => words,
    getCategories: () => ['Tech', 'Logistics'],
    getCategoryStats: () => ({
      Tech: { mastered: 0, total: 2 },
      Logistics: { mastered: 0, total: 1 },
    }),
    selectWordsForRound: () => [byId.w1, byId.w2],
    selectHardWords: () => [],
    generateOptionsForWord: (word) => [word.trans, 'wrong option'],
    updateWordProgress: vi.fn((id, isCorrect) => {
      byId[id].lastSeen = 1;
      if (isCorrect) byId[id].correctCount = (byId[id].correctCount || 0) + 1;
    }),
    getProgressStats: () => ({ mastered: 0 }),
    getCorrectTranslation: (word) => word.trans,
    getQuestionWord: (word) => ({ text: word.eng, isEnglish: true }),
    getWordTranslation: (word) => word.trans,
    getExampleTranslation: () => ({ text: '', usedLang: 'ru' }),
    setWordsIndex: vi.fn(),
  };
});

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

beforeAll(() => {
  localStorage.clear();
  const html = fs.readFileSync(process.cwd() + '/index.html', 'utf8');
  document.documentElement.innerHTML = html.replace(/<\/?html[^>]*>/gi, '');
});

it('boots, plays a full round, and reaches the result screen', async () => {
  await import('../app.js');

  // Boot: menu visible, category list rendered with All + 2 categories.
  await waitFor(() => expect($('category-list').children.length).toBe(3));
  expect(hidden('menu-screen')).toBe(false);
  expect(hidden('game-screen')).toBe(true);
  expect($('hard-words-btn').disabled).toBe(true); // no hard words yet
  expect($('category-list').children[0].textContent).toContain('All');

  // Enter the category screen and start an "All" round.
  $('hunt-btn').click();
  expect(hidden('category-screen')).toBe(false);
  $('category-list').children[0].click();
  expect(hidden('game-screen')).toBe(false);

  // Question 1: two options, progress text uses the i18n template key.
  const options = () => $('options').querySelectorAll('.option-btn');
  await waitFor(() => expect(options().length).toBe(2));
  expect($('word').textContent).toBe('guarantee');
  expect($('question-progress-text').textContent).toContain('question_progress');

  // Answer correctly → +10 XP, streak recorded, option marked correct.
  options()[0].click();
  await waitFor(async () => {
    const { store } = await import('../store.js');
    expect(store.getState().xp).toBe(10);
  });
  expect(localStorage.getItem('pwh_lastPlayed')).toBe(new Date().toISOString().slice(0, 10));
  expect(localStorage.getItem('pwh_streak')).toBe('1');
  expect(options()[0].classList.contains('correct')).toBe(true);

  // Explanation shows after the 1s delay; progress was saved to storage.
  await waitFor(() => expect(hidden('explanation-modal')).toBe(false), 5000);
  await waitFor(() => expect(localStorage.getItem('pixelWordHunter_save_v3_guest')).toContain('w1'));
  expect($('explanation-list').textContent).toContain('guarantee');
  expect($('next-question-btn').style.display).toBe('inline-block');

  // Question 2: answer wrong → correct option is highlighted.
  $('next-question-btn').click();
  await waitFor(() => expect(options().length).toBe(2));
  expect($('word').textContent).toBe('invoice');
  options()[1].click();
  await waitFor(() => expect(hidden('explanation-modal')).toBe(false), 5000);
  expect(options()[0].classList.contains('correct')).toBe(true);

  // Round end → result modal with the summary (1 of 2 correct, 50%).
  $('next-question-btn').click();
  await waitFor(() => expect(hidden('result-modal')).toBe(false));
  const summary = $('result-summary').textContent;
  expect(summary).toContain('correct_count: 1');
  expect(summary).toContain('accuracy: 50%');
  expect(summary).toContain('xp_earned: 10');

  // Continue → next round starts with a fresh question.
  $('result-continue-btn').click();
  expect(hidden('result-modal')).toBe(true);
  await waitFor(() => expect($('word').textContent).toBe('guarantee'));
});
