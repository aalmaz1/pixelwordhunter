// @vitest-environment jsdom
/**
 * Smoke test for the FULL TOEIC TESTS mode: TOEIC TESTS → full test list →
 * part list → part run (listening transcript voiced via speechSynthesis,
 * reading passage with KO toggle) → result modal. Boots the real app.js
 * against index.html with mocked i18n/data/toeic banks.
 */
import { beforeAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { BLANK_PAUSE_MS } from '../speech.js';
import { I18nManager } from '../i18n.js';

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('../i18n.js', () => ({
  I18nManager: {
    init: async () => {},
    t: (key) => ({
      full_explanation_missing_en: {
        en: 'No English explanation in the source.',
        ru: 'В источнике нет английского объяснения.',
        ko: '원본에 영어 해설이 없습니다.',
      }[i18nState.language] || 'No English explanation in the source.',
      full_explanation_missing_ko: {
        en: 'No Korean explanation in the source.',
        ru: 'В источнике нет корейского объяснения.',
        ko: '원본에 한국어 해설이 없습니다.',
      }[i18nState.language] || 'No Korean explanation in the source.',
      full_explanation_ko_fallback: {
        en: 'Korean unavailable; showing English.',
        ru: 'Корейского нет; показано английское.',
        ko: '한국어 해설이 없어 영어로 표시합니다.',
      }[i18nState.language] || 'Korean unavailable; showing English.',
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
      show_transcript: 'SHOW TRANSCRIPT',
      hide_transcript: 'HIDE TRANSCRIPT',
      listening_graphic: 'LISTENING GRAPHIC',
      listening_graphic_open: 'Open listening graphic at full size',
      passage: 'PASSAGE',
      explanation_label: 'EXPLANATION',
      finish: 'FINISH',
      next: 'NEXT',
      prev: 'PREV',
      exit_menu: 'EXIT',
    }[key] ?? key),
    getCurrentLanguage: () => i18nState.language,
    setLanguage: async (language) => {
      i18nState.language = language;
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: language } }));
    },
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
            audio: 'Where is ____ meeting?',
            questions: [{
              question: 'Where is ____ meeting?',
              options: ['Room 3', 'Room 5', 'Room 7'],
              correct: 'Room 5',
              explanation: { en: '', ko: '회의는 어디입니까?' },
            }],
          }],
        },
        {
          part: 3,
          type: 'listening',
          items: [{
            audio: 'Our budget is $50. We need a cake at least ten inches wide.',
            turns: [
              { speaker: 'W', text: 'Our budget is $50.' },
              { speaker: 'M', text: 'We need a cake at least ten inches wide.' },
            ],
            graphic: {
              image: 'full-toeic-graphics/actual_test_2026_10_67.png',
              html: '<table><tr><td onclick="bad()">Carrot Cake $46</td></tr></table><script>bad()</script>',
            },
            // The first two deliberately mislabel one field, to ensure the
            // UI never leaks Korean or treats English-only text as Korean.
            questions: [
              { question: 'What is the budget?', options: ['$50', '$54', '$58', '$60'], correct: '$50', explanation: { en: '예산은 50달러입니다.', ko: '예산은 50달러입니다.' } },
              { question: 'What size is needed?', options: ['At least 10 inches', '8 inches', '6 inches', '2 inches'], correct: 'At least 10 inches', explanation: { en: 'The cake needs to be at least ten inches wide.', ko: 'English text mislabeled as Korean.' } },
              { question: 'Which cake fits?', options: ['Carrot Cake', 'Chocolate Cake', 'Coconut Cake', 'Cheesecake'], correct: 'Carrot Cake', explanation: { en: '', ko: '' } },
            ],
          }],
        },
        {
          part: 4,
          type: 'listening',
          items: [{
            audio: 'The office opens at nine.',
            questions: [{
              question: 'When does the office open?',
              options: ['Nine', 'Eight', 'Seven', 'Six'],
              correct: 'Nine',
              explanation: { en: 'The announcement says nine.', ko: '안내에 아홉 시라고 나옵니다.' },
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
        {
          part: 6,
          type: 'reading',
          items: [{
            description: 'Topics include <span class="toeic-blank" data-blank="131">(131) ------</span> sales.',
            questions: [{
              question: '131. ____',
              options: ['including', 'although', 'where', 'unless'],
              correct: 'including',
              explanation: { en: 'Including introduces examples.', ko: 'Including은 예시를 소개합니다.' },
            }],
          }],
        },
        {
          part: 7,
          type: 'reading',
          items: [{
            description: 'Free workshops are held every Saturday.',
            questions: [{
              question: 'What is advertised?',
              options: ['Free classes', 'A sale', 'A store', 'A contest'],
              correct: 'Free classes',
              explanation: { en: 'The notice advertises free classes.', ko: '안내문은 무료 수업을 광고합니다.' },
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
  expect($('full-toeic-list').children[0].textContent).toContain('8 QUESTIONS');

  // → the part list (parts 2–7).
  $('full-toeic-list').children[0].click();
  await waitFor(() => expect($('full-part-list').children.length).toBe(6));
  expect(hidden('fullpart-screen')).toBe(false);
  expect($('full-part-list').children[0].textContent).toContain('PART 2 · LISTENING');
  expect($('full-part-list').children[1].textContent).toContain('PART 3 · LISTENING');
  expect($('full-part-list').children[2].textContent).toContain('PART 4 · LISTENING');
  expect($('full-part-list').children[3].textContent).toContain('PART 5 · READING');
  expect($('full-part-list').children[4].textContent).toContain('PART 6 · READING');
  expect($('full-part-list').children[5].textContent).toContain('PART 7 · READING');

  // Start part 2 → listening run. Question card is clickable for audio;
  // transcript is hidden because part 2 question text IS the transcript.
  $('full-part-list').children[0].click();
  expect(hidden('fulltoeicgame-screen')).toBe(false);
  expect($('full-transcript').classList.contains('hidden')).toBe(true);
  expect($('full-question').textContent).toBe('1. Where is ____ meeting?');
  expect($('full-question').classList.contains('clickable-audio')).toBe(true);
  expect($('full-progress-text').textContent).toBe('1 / 1');
  expect(options().length).toBe(3);
  expect($('full-next-btn').textContent).toBe('FINISH');
  expect(hidden('full-explanation')).toBe(true);
  // Switching language before answering neither reveals the explanation nor
  // restarts/cancels the ongoing audio or reshuffles answer controls.
  const firstOption = options()[0];
  const callsBeforeLanguage = window.speechSynthesis.speak.mock.calls.length;
  const cancelsBeforeLanguage = window.speechSynthesis.cancel.mock.calls.length;
  await I18nManager.setLanguage('ko');
  expect(hidden('full-explanation')).toBe(true);
  expect(options()[0]).toBe(firstOption);
  expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(callsBeforeLanguage);
  expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(cancelsBeforeLanguage);
  await I18nManager.setLanguage('en');
  // Even if a listening transcript contains a blank, autoplay and replay
  // should pause at it rather than send underscores to the speech engine.
  expect(window.speechSynthesis.speak.mock.lastCall[0].text).toBe('Where is');
  vi.useFakeTimers();
  window.speechSynthesis.speak.mock.lastCall[0].onend();
  vi.advanceTimersByTime(BLANK_PAUSE_MS);
  expect(window.speechSynthesis.speak.mock.lastCall[0].text).toBe('meeting?');
  $('full-question').click();
  expect(window.speechSynthesis.speak.mock.lastCall[0].text).toBe('Where is');
  window.speechSynthesis.speak.mock.lastCall[0].onend();
  vi.advanceTimersByTime(BLANK_PAUSE_MS);
  expect(window.speechSynthesis.speak.mock.lastCall[0].text).toBe('meeting?');
  // The three response choices are spoken in the same order as the buttons.
  const visibleOptions = options().map((button) => button.querySelector('.toeic-option-text').textContent);
  for (let i = 0; i < 3; i += 1) {
    window.speechSynthesis.speak.mock.lastCall[0].onend();
    expect(window.speechSynthesis.speak.mock.lastCall[0].text.trim()).toBe(`Choice ${'ABC'[i]}.`);
    window.speechSynthesis.speak.mock.lastCall[0].onend();
    expect(window.speechSynthesis.speak.mock.lastCall[0].text.trim()).toBe(`${visibleOptions[i]}.`);
  }
  vi.useRealTimers();

  // Correct answer → remaining audio stops and is not replayed on answering.
  const speakCalls = window.speechSynthesis.speak.mock.calls.length;
  const cancelsBeforeAnswer = window.speechSynthesis.cancel.mock.calls.length;
  const staleEnd = window.speechSynthesis.speak.mock.lastCall[0].onend;
  optionByText('Room 5').click();
  expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(cancelsBeforeAnswer + 1);
  staleEnd(); // a late callback cannot resume the old choices
  expect(optionByText('Room 5').classList.contains('correct')).toBe(true);
  expect(options().every((b) => b.disabled)).toBe(true);
  expect(hidden('full-explanation')).toBe(false);
  expect($('full-explanation-note').textContent).toBe('No English explanation in the source.');
  expect($('full-explanation-en').textContent).toBe('');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('ru');
  expect($('full-explanation-note').textContent).toBe('В источнике нет английского объяснения.');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('회의는 어디입니까?');
  expect($('full-explanation-en').textContent).toBe('');
  expect($('full-explanation-note').textContent).toBe('');
  await I18nManager.setLanguage('en');
  expect($('full-explanation-ko').textContent).toBe('');
  expect(options().every((b) => b.disabled)).toBe(true);
  expect(optionByText('Room 5').classList.contains('correct')).toBe(true);
  expect(window.speechSynthesis.speak.mock.calls.length).toBe(speakCalls);
  expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(cancelsBeforeAnswer + 1);

  // FINISH cancels any pending gap before opening the result modal.
  vi.useFakeTimers();
  $('full-question').click();
  window.speechSynthesis.speak.mock.lastCall[0].onend();
  const speakCallsBeforeFinish = window.speechSynthesis.speak.mock.calls.length;
  $('full-next-btn').click();
  vi.advanceTimersByTime(BLANK_PAUSE_MS);
  expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(speakCallsBeforeFinish);
  vi.useRealTimers();
  // Result: 1 of 1 correct, no review block.
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));
  const summary = $('fulltoeic-result-summary').textContent;
  expect(summary).toContain('CORRECT: 1');
  expect(summary).toContain('ACCURACY: 100%');
  expect(summary).toContain('XP EARNED: 2');
  expect($('fulltoeic-result-review').textContent).toBe('');

  // NEXT PART → dialogue: roles are understandable, and the necessary graphic
  // is shown in both image and safe HTML form. Questions stay in source order.
  $('fulltoeic-result-next-btn').click();
  expect(hidden('fulltoeicgame-screen')).toBe(false);
  expect($('full-question').textContent).toContain('What is the budget?');
  expect(hidden('full-graphic-box')).toBe(false);
  const graphic = $('full-graphic-content');
  expect(graphic.querySelector('img').getAttribute('src')).toBe('full-toeic-graphics/actual_test_2026_10_67.png');
  expect(graphic.textContent).toContain('Carrot Cake $46');
  expect(graphic.querySelector('script')).toBeNull();
  expect(graphic.querySelector('[onclick]')).toBeNull();
  expect($('full-transcript').textContent).toContain('Woman: Our budget is $50.');
  expect($('full-transcript').textContent).toContain('Man: We need a cake');
  expect(window.speechSynthesis.speak.mock.lastCall[0].text).toBe('Woman.');

  // The transcript can be hidden for listening practice and restored on demand.
  $('full-transcript-toggle').click();
  expect(hidden('full-transcript')).toBe(true);
  expect($('full-transcript-toggle').getAttribute('aria-expanded')).toBe('false');
  $('full-transcript-toggle').click();
  expect(hidden('full-transcript')).toBe(false);
  expect($('full-transcript-toggle').getAttribute('aria-expanded')).toBe('true');

  // Wrong first answer, then moving within the group does not automatically
  // repeat the entire dialogue. The explicit replay button still works.
  optionByText('$54').click();
  expect($('full-explanation-note').textContent).toBe('No English explanation in the source.');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('예산은 50달러입니다.');
  expect($('full-explanation-en').textContent).toBe('');
  await I18nManager.setLanguage('en');
  const callsBeforeSecondQuestion = window.speechSynthesis.speak.mock.calls.length;
  $('full-next-btn').click();
  expect($('full-question').textContent).toContain('What size is needed?');
  expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(callsBeforeSecondQuestion);
  expect(hidden('full-graphic-box')).toBe(false);
  $('full-replay-btn').click();
  expect(window.speechSynthesis.speak.mock.lastCall[0].text).toBe('Woman.');
  optionByText('At least 10 inches').click();
  expect($('full-explanation-en').textContent).toBe('The cake needs to be at least ten inches wide.');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-note').textContent).toBe('한국어 해설이 없어 영어로 표시합니다.');
  expect($('full-explanation-en').textContent).toBe('The cake needs to be at least ten inches wide.');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('ru');
  expect($('full-explanation-note').textContent).toBe('');
  expect($('full-explanation-en').textContent).toBe('The cake needs to be at least ten inches wide.');
  await I18nManager.setLanguage('en');
  const callsBeforeThirdQuestion = window.speechSynthesis.speak.mock.calls.length;
  $('full-next-btn').click();
  expect($('full-question').textContent).toContain('Which cake fits?');
  expect(hidden('full-explanation')).toBe(true);
  expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(callsBeforeThirdQuestion);
  optionByText('Carrot Cake').click();
  expect($('full-explanation-note').textContent).toBe('No English explanation in the source.');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-note').textContent).toBe('원본에 한국어 해설이 없습니다.');
  expect($('full-explanation-en').textContent).toBe('');
  expect($('full-explanation-ko').textContent).toBe('');
  // Any non-Korean interface language uses English, not the Korean field.
  await I18nManager.setLanguage('fr');
  expect($('full-explanation-note').textContent).toBe('No English explanation in the source.');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('en');
  $('full-next-btn').click();
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));
  expect($('fulltoeic-result-summary').textContent).toContain('CORRECT: 2');

  // Part 4 uses the same one-language policy for listening explanations.
  $('fulltoeic-result-next-btn').click();
  expect($('full-question').textContent).toContain('When does the office open?');
  optionByText('Nine').click();
  expect($('full-explanation-en').textContent).toBe('The announcement says nine.');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('안내에 아홉 시라고 나옵니다.');
  expect($('full-explanation-en').textContent).toBe('');
  await I18nManager.setLanguage('en');
  $('full-next-btn').click();
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));

  // NEXT PART → part 5: reading passage with a KO toggle, no audio box/graphic.
  $('fulltoeic-result-next-btn').click();
  expect(hidden('fulltoeicgame-screen')).toBe(false);
  expect(hidden('full-graphic-box')).toBe(true);
  expect(hidden('full-listening-controls')).toBe(true);
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
  expect($('full-explanation-en').textContent).toBe('The passage says Q3.');
  expect($('full-explanation-en').getAttribute('lang')).toBe('en');
  expect($('full-explanation-en').classList.contains('lang-en')).toBe(true);
  expect($('full-explanation-ko').getAttribute('lang')).toBe('ko');
  expect($('full-explanation-ko').textContent).toBe('');
  expect($('full-explanation-ru')).toBeNull();
  const wrongButton = optionByText('Q1');
  await I18nManager.setLanguage('ru');
  expect($('full-explanation-en').textContent).toBe('The passage says Q3.');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('지문에 3분기라고 되어 있습니다.');
  expect($('full-explanation-en').textContent).toBe('');
  expect(optionByText('Q1')).toBe(wrongButton);
  expect(wrongButton.disabled).toBe(true);
  await I18nManager.setLanguage('en');
  $('full-next-btn').click();
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));
  expect($('fulltoeic-result-review').textContent).toContain('YOUR ANSWER: Q1');
  expect($('fulltoeic-result-review').textContent).toContain('CORRECT ANSWER: Q3');

  // Parts 6 and 7 also show exactly one of the available explanations.
  $('fulltoeic-result-next-btn').click();
  expect($('full-question').textContent).toContain('131. ____');
  optionByText('including').click();
  expect($('full-explanation-en').textContent).toBe('Including introduces examples.');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('Including은 예시를 소개합니다.');
  expect($('full-explanation-en').textContent).toBe('');
  await I18nManager.setLanguage('en');
  $('full-next-btn').click();
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));
  $('fulltoeic-result-next-btn').click();
  expect($('full-question').textContent).toContain('What is advertised?');
  optionByText('Free classes').click();
  await I18nManager.setLanguage('ru');
  expect($('full-explanation-en').textContent).toBe('The notice advertises free classes.');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('안내문은 무료 수업을 광고합니다.');
  expect($('full-explanation-en').textContent).toBe('');
  await I18nManager.setLanguage('en');
  $('full-next-btn').click();
  await waitFor(() => expect(hidden('fulltoeic-result-modal')).toBe(false));

  // CHOOSE PART → the part list gained a MISTAKES entry with both errors.
  $('fulltoeic-result-parts-btn').click();
  expect(hidden('fullpart-screen')).toBe(false);
  await waitFor(() => expect($('full-part-list').children.length).toBe(7));
  expect($('full-part-list').children[0].textContent).toContain('TOEIC MISTAKES');
  expect($('full-part-list').children[0].textContent).toContain('2');

  // Mistakes review must keep the dialogue, identities and graphic too.
  $('full-part-list').children[0].click();
  expect($('full-question').textContent).toContain('report covers');
  expect(hidden('full-graphic-box')).toBe(true);
  expect(hidden('full-explanation')).toBe(true);
  optionByText('Q1').click();
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('지문에 3분기라고 되어 있습니다.');
  expect($('full-explanation-en').textContent).toBe('');
  await I18nManager.setLanguage('ru');
  expect($('full-explanation-en').textContent).toBe('The passage says Q3.');
  expect($('full-explanation-ko').textContent).toBe('');
  $('full-next-btn').click();
  expect($('full-question').textContent).toContain('What is the budget?');
  expect(hidden('full-graphic-box')).toBe(false);
  expect($('full-graphic-content').querySelector('img').getAttribute('src'))
    .toBe('full-toeic-graphics/actual_test_2026_10_67.png');
  expect($('full-transcript').textContent).toContain('Woman: Our budget is $50.');
  expect(window.speechSynthesis.speak.mock.lastCall[0].text).toBe('Woman.');
  optionByText('$54').click();
  expect($('full-explanation-note').textContent).toBe('В источнике нет английского объяснения.');
  expect($('full-explanation-ko').textContent).toBe('');
  await I18nManager.setLanguage('ko');
  expect($('full-explanation-ko').textContent).toBe('예산은 50달러입니다.');
  expect($('full-explanation-en').textContent).toBe('');

  random.mockRestore();
});
