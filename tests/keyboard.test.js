// @vitest-environment jsdom
/**
 * Keyboard-accessibility tests for the shortcut dispatcher in app.js.
 *
 * The app must be fully playable from a laptop keyboard: focus lands inside the
 * screen that just opened, digits/arrows/Enter drive a round, Escape walks back
 * up the navigation stack, and no shortcut fires twice (jsdom does not
 * synthesise the native click a real browser fires for Enter on a focused
 * button, so the "double advance" guard is asserted through the dispatcher:
 * it must stay out of the way when the target activates itself).
 */
import { beforeAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('../i18n.js', () => ({
  I18nManager: {
    init: async () => {},
    t: (key) => ({
      all_categories: 'All',
      hard_words: 'REVIEW HARD WORDS',
      words_one: 'WORD',
      words_other: 'WORDS',
      questions_one: 'QUESTION',
      questions_other: 'QUESTIONS',
      wrong_count_one: 'wrong_count',
      wrong_count_other: 'wrong_count',
      toeic_mistakes: 'MISTAKES',
      toeic_mistakes_title: 'TOEIC MISTAKES',
      repeat_mistakes: 'REPEAT MISTAKES ONLY',
      your_answer: 'YOUR ANSWER',
      correct_answer: 'CORRECT ANSWER',
    }[key] ?? key),
    getCurrentLanguage: () => 'en',
    setLanguage: async () => {},
  },
}));

vi.mock('../data.js', () => {
  const words = [
    { id: 'w1', eng: 'guarantee', trans: 'гарантия', category: 'Tech' },
    { id: 'w2', eng: 'invoice', trans: 'счёт-фактура', category: 'Tech' },
    { id: 'w3', eng: 'freight', trans: 'фрахт', category: 'Tech' },
  ];
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  return {
    loadGameData: async () => words,
    getGameData: () => words,
    getCategories: () => ['Tech'],
    getCategoryStats: () => ({ Tech: { mastered: 0, total: 3 } }),
    selectWordsForRound: () => [byId.w1, byId.w2, byId.w3],
    selectHardWords: () => [],
    generateOptionsForWord: (word) => [word.trans, 'wrong option'],
    updateWordProgress: vi.fn(),
    getProgressStats: () => ({ mastered: 0 }),
    getCorrectTranslation: (word) => word.trans,
    getQuestionWord: (word) => ({ text: word.eng, isEnglish: true }),
    getWordTranslation: (word) => word.trans,
    getExampleTranslation: () => ({ text: '', usedLang: 'ru' }),
    setWordsIndex: vi.fn(),
  };
});

vi.mock('../toeic.js', () => ({
  TOEIC_DATA: {
    categories: [{ id: 1, name: 'Part 5 · Set 1' }],
    questions: [
      { id: 1, type_id: 1, category: 'Part 5 · Set 1', question: 'Fill the ____', options: ['gap', 'hole', 'space', 'void'], correct: 'gap' },
      { id: 2, type_id: 1, category: 'Part 5 · Set 1', question: 'Choose ____', options: ['alpha', 'beta', 'gamma', 'delta'], correct: 'beta' },
    ],
  },
}));

const $ = (id) => document.getElementById(id);
const hidden = (id) => $(id).classList.contains('hidden');
const options = () => $('options').querySelectorAll('.option-btn');
const toeicOptions = () => $('toeic-options').querySelectorAll('.option-btn');
const waitFor = async (fn, ms = 4000) => {
  const start = Date.now();
  for (;;) {
    try { await fn(); return; } catch (e) {
      if (Date.now() - start > ms) throw e;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
};

/** Dispatch a real keydown from the focused element (or an explicit target). */
const press = (key, { target, code, shiftKey = false } = {}) => {
  const event = new KeyboardEvent('keydown', {
    key, code, shiftKey, bubbles: true, cancelable: true,
  });
  (target || document.activeElement || document.body).dispatchEvent(event);
  return event;
};

beforeAll(() => {
  localStorage.clear();
  const html = fs.readFileSync(process.cwd() + '/index.html', 'utf8');
  document.documentElement.innerHTML = html.replace(/<\/?html[^>]*>/gi, '');
});

it('plays the whole app from the keyboard', async () => {
  await import('../app.js');
  const { store } = await import('../store.js');

  await waitFor(() => expect($('category-list').children.length).toBe(2));

  // A signed-in player gets the HUNT button (the guest path signs in for real).
  localStorage.setItem('pixelWordHunter_authMethod', 'anonymous');
  store.setUser({ uid: 'test', isAnonymous: true });
  await waitFor(() => expect(hidden('hunt-btn')).toBe(false));

  // Boot: the menu is up and focus already sits inside the screen, so Tab does
  // not restart from the top of the document.
  expect(hidden('menu-screen')).toBe(false);
  expect(document.activeElement).toBe($('menu-screen'));

  // ── The shortcut sheet lives in Settings, not on the menu ──
  expect($('keyboard-help-btn')).not.toBeNull();
  expect($('keyboard-help-btn').closest('#settings-screen')).not.toBeNull();
  expect($('menu-screen').querySelector('#keyboard-help-btn')).toBeNull();
  $('settings-btn').click();
  expect(hidden('settings-screen')).toBe(false);
  $('keyboard-help-btn').click();
  expect(hidden('keyboard-help-modal')).toBe(false);
  expect(document.activeElement).toBe($('keyboard-help-close-btn'));
  press('Escape');
  expect(hidden('keyboard-help-modal')).toBe(true);
  // Focus comes back to the control that opened the sheet.
  expect(document.activeElement).toBe($('keyboard-help-btn'));
  press('Escape'); // Settings → menu
  expect(hidden('menu-screen')).toBe(false);
  expect(document.activeElement).toBe($('menu-screen'));

  // ── "?" opens the same sheet from anywhere, on any keyboard layout ──
  // On a Russian layout "?" is Shift+7, so the physical key is Digit7.
  press('?', { code: 'Digit7', shiftKey: true });
  expect(hidden('keyboard-help-modal')).toBe(false);
  press('Escape');
  expect(hidden('keyboard-help-modal')).toBe(true);
  expect(document.activeElement).toBe($('menu-screen'));

  // ── "M" toggles sound, matched by physical key ("ь" on a Russian layout) ──
  const audioBefore = store.getState().audioEnabled;
  press('m', { code: 'KeyM' });
  expect(store.getState().audioEnabled).toBe(!audioBefore);
  press('ь', { code: 'KeyM' });
  expect(store.getState().audioEnabled).toBe(audioBefore);

  // ── Enter on the menu starts a hunt; the mode chooser focuses its first mode ──
  press('Enter');
  expect(hidden('mode-screen')).toBe(false);
  expect(document.activeElement).toBe($('mode-word-quiz-btn'));
  press('ArrowDown');
  expect(document.activeElement).toBe($('mode-toeic-btn'));

  // ── "1" picks WORD QUIZ ──
  press('1');
  expect(hidden('category-screen')).toBe(false);
  expect(document.activeElement).toBe($('category-screen'));

  // ── Arrows walk the category grid ──
  press('ArrowRight');
  expect(document.activeElement.classList.contains('category-btn')).toBe(true);
  const firstCategory = document.activeElement.textContent;

  // ── "/" jumps to the search field (by physical key: it types "." in Russian);
  // Enter starts the first match ──
  press('.', { code: 'Slash' });
  const search = $('category-search');
  expect(document.activeElement).toBe(search);
  search.value = 'tech';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  expect(firstCategory).toContain('All'); // filter actually hides the others
  press('Enter', { target: search });
  expect(hidden('game-screen')).toBe(false);

  await waitFor(() => expect(options().length).toBe(2));
  // A keyboard player lands on the first option — no Tab round-trip needed.
  expect(document.activeElement).toBe(options()[0]);

  // ── Arrows move between options (and wrap around) ──
  press('ArrowRight');
  expect(document.activeElement).toBe(options()[1]);
  press('ArrowDown');
  expect(document.activeElement).toBe(options()[0]);
  press('ArrowLeft');
  expect(document.activeElement).toBe(options()[1]);
  press('ArrowUp');
  expect(document.activeElement).toBe(options()[0]);

  // ── Space with focus on the round only parks focus on the first option ──
  press(' ', { target: $('game-screen') });
  expect(store.getState().isAnswerLocked).toBe(false);
  expect(document.activeElement).toBe(options()[0]);

  // ── "1" answers with the first option (the correct one in this mock) ──
  press('1');
  expect(store.getState().isAnswerLocked).toBe(true);
  expect(options()[0].classList.contains('correct')).toBe(true);

  // Word Review opens a second later and takes focus.
  await waitFor(() => expect(hidden('explanation-modal')).toBe(false), 5000);
  expect(document.activeElement).toBe($('next-question-btn'));

  // ── Regression guard: the dispatcher must not click the focused NEXT twice.
  // In a real browser Enter already activates the button; clicking it here too
  // skipped a whole question.
  const qBefore = store.getState().currentQ;
  press('Enter', { target: $('next-question-btn') });
  expect(store.getState().currentQ).toBe(qBefore);

  // ── Enter with focus on the dialog itself still continues ──
  press('Enter', { target: $('explanation-modal') });
  await waitFor(() => expect(store.getState().currentQ).toBe(qBefore + 1));
  await waitFor(() => expect(options().length).toBe(2));

  // ── Escape closes Word Review first, a second Escape leaves the round ──
  press('1');
  expect(store.getState().isAnswerLocked).toBe(true);
  await waitFor(() => expect(hidden('explanation-modal')).toBe(false), 5000);
  press('Escape');
  expect(hidden('explanation-modal')).toBe(true);
  expect(hidden('game-screen')).toBe(false);
  press('Escape');
  expect(hidden('menu-screen')).toBe(false);
  expect(document.activeElement).toBe($('menu-screen'));

  // ── TOEIC TESTS: "2" from the mode chooser, arrows walk the test list ──
  press('Enter');
  press('2');
  await waitFor(() => expect($('toeic-list').children.length).toBe(1));
  expect(hidden('toeic-screen')).toBe(false);
  // Arrows move (and the ring is now visible), but a numbered list also answers
  // to its digits: "1" starts the first visible test.
  press('ArrowRight');
  expect(document.activeElement.classList.contains('category-btn')).toBe(true);
  press('1');
  expect(hidden('toeicgame-screen')).toBe(false);

  await waitFor(() => expect(toeicOptions().length).toBe(4));
  expect(document.activeElement).toBe(toeicOptions()[0]);

  // ── ↑ / ↓ move between the four options ──
  press('ArrowDown');
  expect(document.activeElement).toBe(toeicOptions()[1]);
  press('ArrowUp');
  expect(document.activeElement).toBe(toeicOptions()[0]);

  // ── "A" answers (matched by physical key: it reports "ф" in Russian); the
  // question locks and focus moves to NEXT ──
  press('ф', { code: 'KeyA' });
  expect([...toeicOptions()].every((btn) => btn.disabled)).toBe(true);
  expect(document.activeElement).toBe($('toeic-next-btn'));

  // ── ← / → walk the questions ──
  press('ArrowRight');
  expect($('toeic-progress-text').textContent).toBe('2 / 2');
  press('ArrowLeft');
  expect($('toeic-progress-text').textContent).toBe('1 / 2');

  // ── Escape returns to the test list ──
  press('Escape');
  expect(hidden('toeic-screen')).toBe(false);
  expect(hidden('toeicgame-screen')).toBe(true);
});
