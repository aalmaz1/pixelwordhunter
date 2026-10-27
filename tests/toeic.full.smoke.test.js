// @vitest-environment jsdom
/**
 * Smoke test for the FULL TOEIC TESTS mode: TOEIC TESTS → full test list →
 * part list → part run (listening transcript voiced via speechSynthesis,
 * reading passage with KO toggle) → result modal. Boots the real app.js
 * against index.html with mocked i18n/data/toeic banks.
 */
import { beforeAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('../i18n.js', () => ({
  I18nManager: {
    init: async () => {},
    t: (key) => ({
      all_categories: 'All',
      toeic_mistakes: 'MISTAKES',
      toeic_mistakes_title: 'TOEIC MISTAKES',
      questions_one: 'QUESTION',
      questions_other: 'QUESTIONS',
      wrong_count_one: 'wrong_count',
      repeat_mistakes: 'REPEAT MISTAKES ONLY',
      your_answer: 'YOUR ANSWER',
      correct_answer: 'CORRECT ANSWER',
      correct_count: 'CORRECT',
      accuracy: 'ACCURACY',
      xp_earned: 'XP EARNED',
      full_toeic_tests: 'FULL TOEIC TESTS',
      part_label: 'PART',
      full_listening: 'LISTENING',
      full_reading: 'READING',
      full_choose_part: 'CHOOSE PART',
      full_test_complete: '// PART COMPLETE //',
      full_retry_part: 'RETRY PART',
      full_next_part: 'NEXT PART',
      play_audio: 'PLAY',
      replay_audio: 'REPLAY',
      passage: 'PASSAGE',
      explanation_label: 'EXPLANATION',
      finish: 'FINISH',
      next: 'NEXT',
      prev: 'PREV',
      exit_menu: 'EXIT',
    }[key] ?? key),
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

// No Part 5 sets in this smoke test — only the full-test flow matters here.
vi.mock('../toeic.js', () => ({ TOEIC_DATA: { categories: [], questions: [] } }));

// Deterministic stand-in for the full-test bank (real file: toeic_full_tests.json).
vi.mock('../toeic_full.js', () => ({
  FULL_TOEIC_DATA: {
    tests: [{
      id: 'smoke_test',
      name: 'Smoke Full Test',
      targetScore: '700-900',
      parts: [
        {
          part: 2,
          type: 'listening',
          items: [{
            audio: 'Where is the meeting?',
            questions: [{
              question: 'Where is the meeting?',
              options: ['Room 3', 'Room 5', 'Room 7'],
              correct: 'Room 5',
              explanation: { en: '', ko: '회의는 어디입니까?' },
            }],
          }],
        },
        {
          part: 5,
          type: 'reading',
          items: [{
            description: 'The report covers <b>Q3</b> sales.',
            descriptionKo: '보고서는 3분기 매출을 다룹니다.',
            questions: [{
              question: 'The report covers ____ sales.',
              options: ['Q1', 'Q3', 'Q4', 'Q5'],
              correct: 'Q3',
              explanation: { en: 'The passage says Q3.', ko: '지문에 3분기라고 되어 있습니다.' },
            }],
          }],
        },
      ],
    }],
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
const options = () => [...$('full-options').querySelectorAll('.option-btn')];
const optionByText = (text) => options().find((b) => b.textContent.includes(text));

beforeAll(() => {
  localStorage.clear();
  const html = fs.readFileSync(process.cwd() + '/index.html', 'utf8');
  document.documentElement.innerHTML = html.replace(/<\/?html[^>]*>/gi, '');
  // speechSynthesis is not in jsdom — mock it before app.js reads
  // `'speechSynthesis' in window` at module scope.
  window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  window.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; }
  };
});

it('runs a full TOEIC test through the real UI', async () => {
  // Force a deterministic shuffle: Math.random() === 0 makes Fisher-Yates
  // reverse the item order and reorder the options predictably.
  const random = vi.spyOn(Math, 'random').mockReturnValue(0);
  await import('../app.js');

  // Boot to menu, then HUNT opens the mode chooser.
  await waitFor(() => expect($('category-list').children.length).toBe(2)); // All + Tech
  $('hunt-btn').click();
  $('mode-toeic-btn').click();

  // TOEIC TESTS → list with the FULL TOEIC TESTS entry (no Part 5 sets here).
  await waitFor(() => expect($('toeic-list').children.length).toBe(1));
  expect($('toeic-list').children[0].textContent).toContain('FULL TOEIC TESTS');

  // → the test list.
  $('toeic-list').children[0].click();
  await waitFor(() => expect($('full-toeic-list').children.length).toBe(1));
  expect(hidden('fulltoeic-screen')).toBe(false);
  expect($('full-toeic-list').children[0].textContent).toContain('Smoke Full Test');
  expect($('full-toeic-list').children[0].textContent).toContain('2 QUESTIONS');

  // → the part list (parts 2 and 5).
  $('full-toeic-list').children[0].click();
  await waitFor(() => expect($('full-part-list').children.length).toBe(2));
  expect(hidden('fullpart-screen')).toBe(false);
  expect($('full-part-list').children[0].textContent).toContain('PART 2 · LISTENING');
  expect($('full-part-list').children[1].textContent).toContain('PART 5 · READING');

  // Start part 2 → listening run. Question card is clickable for audio;
  // transcript is hidden because part 2 question text IS the transcript.
  $('full-part-list').children[0].click();
  expect(hidden('fulltoeicgame-screen')).toBe(false);
  expect($('full-transcript').classList.contains('hidden')).toBe(true);
  expect($('full-question').textContent).toBe('1. Where is the meeting?');
  expect($('full-question').classList.contains('clickable-audio')).toBe(true);
  expect($('full-progress-text').textContent).toBe('1 / 1');
  expect(options().length).toBe(3);
  expect($('full-next-btn').textContent).toBe('FINISH');
  expect(window.speechSynthesis.speak).toHaveBeenCalled(); // transcript voiced

  // Correct answer → KO explanation shown, audio NOT replayed on answering.
  const speakCalls = window.speechSynthesis.speak.mock.calls.length;
  optionByText('Room 5').click();
  expect(optionByText('Room 5').classList.contains('correct')).toBe(true);
  expect(options().every((b) => b.disabled)).toBe(true);
  expect($('full-explanation').classList.contains('hidden')).toBe(false);
  expect($('full-explanation-ko').textContent).toContain('회의는 어디입니까?');
  expect(window.speechSynthesis.speak.mock.calls.length).toBe(speakCalls);

  // FINISH → result modal: 1 of 1 correct, no review block.
  $('full-next-btn').click();
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));
  const summary = $('fulltoeic-result-summary').textContent;
  expect(summary).toContain('CORRECT: 1');
  expect(summary).toContain('ACCURACY: 100%');
  expect(summary).toContain('XP EARNED: 2');
  expect($('fulltoeic-result-review').textContent).toBe('');

  // NEXT PART → part 5: reading passage with a KO toggle, no audio box.
  $('fulltoeic-result-next-btn').click();
  expect(hidden('fulltoeicgame-screen')).toBe(false);
  expect($('full-description').innerHTML).toContain('Q3');
  expect($('full-desc-toggle').hidden).toBe(false);
  expect($('full-transcript').classList.contains('hidden')).toBe(true);

  // The KO toggle swaps the passage between EN and KO.
  $('full-desc-toggle').click();
  expect($('full-description').innerHTML).toContain('3분기');
  $('full-desc-toggle').click();
  expect($('full-description').innerHTML).toContain('Q3');

  // Wrong answer → verdict + both answers in the review.
  optionByText('Q1').click();
  expect(optionByText('Q1').classList.contains('wrong')).toBe(true);
  expect(optionByText('Q3').classList.contains('correct')).toBe(true);
  $('full-next-btn').click();
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));
  expect($('fulltoeic-result-review').textContent).toContain('YOUR ANSWER: Q1');
  expect($('fulltoeic-result-review').textContent).toContain('CORRECT ANSWER: Q3');

  // CHOOSE PART → the part list gained a MISTAKES entry.
  $('fulltoeic-result-parts-btn').click();
  expect(hidden('fullpart-screen')).toBe(false);
  await waitFor(() => expect($('full-part-list').children.length).toBe(3));
  expect($('full-part-list').children[0].textContent).toContain('TOEIC MISTAKES');
  expect($('full-part-list').children[0].textContent).toContain('1');

  random.mockRestore();
});
