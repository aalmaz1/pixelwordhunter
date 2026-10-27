import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLANK_PAUSE_MS, createSpeechPlayer } from '../speech.js';

class MockUtterance {
  constructor(text) { this.text = text; }
}

function setup() {
  const synthesis = { speak: vi.fn(), cancel: vi.fn() };
  const player = createSpeechPlayer(synthesis, MockUtterance);
  const utterances = () => synthesis.speak.mock.calls.map(([utterance]) => utterance);
  const texts = () => utterances().map((utterance) => utterance.text);
  return { synthesis, player, utterances, texts };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('speech player', () => {
  it('keeps ordinary pronunciation and single underscores unchanged', () => {
    const { player, utterances, texts } = setup();
    player.speak('a user_id', 'en', { pauseAtBlanks: true });
    expect(texts()).toEqual(['a user_id']);
    expect(utterances()[0]).toMatchObject({ lang: 'en-US', rate: 0.95, pitch: 1 });

    player.speak('안녕하세요', 'ko');
    expect(utterances()[1]).toMatchObject({ text: '안녕하세요', lang: 'ko-KR' });
    player.speak('привет', 'ru');
    expect(utterances()[2]).toMatchObject({ text: 'привет', lang: 'ru-RU' });
  });

  it('pauses silently for a blank without reading it or revealing an answer', () => {
    const { player, utterances, texts } = setup();
    player.speak('Please ____ the report.', 'en', { pauseAtBlanks: true });
    expect(texts()).toEqual(['Please']);
    utterances()[0].onend();
    vi.advanceTimersByTime(BLANK_PAUSE_MS - 1);
    expect(texts()).toEqual(['Please']);
    vi.advanceTimersByTime(1);
    expect(texts()).toEqual(['Please', 'the report.']);
    expect(texts().join(' ')).not.toContain('_');
  });

  it('handles leading, trailing and multiple blanks without speaking punctuation alone', () => {
    const { player, utterances, texts } = setup();
    player.speak('____ is ____ than ______.', 'en', { pauseAtBlanks: true });
    expect(texts()).toEqual([]);
    vi.advanceTimersByTime(BLANK_PAUSE_MS);
    expect(texts()).toEqual(['is']);
    utterances()[0].onend();
    vi.advanceTimersByTime(BLANK_PAUSE_MS);
    expect(texts()).toEqual(['is', 'than']);
    utterances()[1].onend();
    vi.advanceTimersByTime(BLANK_PAUSE_MS);
    expect(texts()).toEqual(['is', 'than']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves sentence-by-sentence playback for listening transcripts', () => {
    const { player, utterances, texts } = setup();
    player.speak("Where is the meeting? It's in room 5.", 'en', {
      splitSentences: true,
      pauseAtBlanks: true,
    });
    expect(texts()).toEqual(['Where is the meeting?']);
    utterances()[0].onend();
    expect(texts()).toEqual(['Where is the meeting?', " It's in room 5."]);
    utterances()[1].onend();
    expect(texts()).toHaveLength(2);
  });

  it('cancels pending pauses and ignores late utterance callbacks on replay', () => {
    const { player, synthesis, utterances, texts } = setup();
    player.speak('Old ____ sentence.', 'en', { pauseAtBlanks: true });
    const oldEnd = utterances()[0].onend;
    oldEnd(); // waiting at the gap

    player.speak('New ____ sentence.', 'en', { pauseAtBlanks: true });
    const newEnd = utterances()[1].onend;
    oldEnd(); // a late event from the cancelled utterance must do nothing
    newEnd();
    vi.advanceTimersByTime(BLANK_PAUSE_MS);
    expect(texts()).toEqual(['Old', 'New', 'sentence.']);
    expect(synthesis.cancel).toHaveBeenCalledTimes(2);

    player.cancel();
    const count = utterances().length;
    newEnd();
    vi.runAllTimers();
    expect(utterances()).toHaveLength(count);
  });

  it('can stop while a gap is in progress', () => {
    const { player, utterances, texts } = setup();
    player.speak('Before ____ after.', 'en', { pauseAtBlanks: true });
    utterances()[0].onend();
    player.cancel();
    vi.advanceTimersByTime(BLANK_PAUSE_MS);
    expect(texts()).toEqual(['Before']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not continue if a speech fragment errors or ends twice', () => {
    const { player, utterances, texts } = setup();
    player.speak('Before ____ after.', 'en', { pauseAtBlanks: true });
    const first = utterances()[0];
    first.onerror();
    first.onend();
    vi.runAllTimers();
    expect(texts()).toEqual(['Before']);

    player.speak('Again ____ after.', 'en', { pauseAtBlanks: true });
    const second = utterances()[1];
    second.onend();
    second.onend();
    vi.advanceTimersByTime(BLANK_PAUSE_MS);
    expect(texts()).toEqual(['Before', 'Again', 'after.']);
  });

  it('is safe when speech synthesis is unavailable', () => {
    const player = createSpeechPlayer(undefined, undefined);
    expect(player.supported).toBe(false);
    expect(() => {
      player.speak('A ____ B', 'en', { pauseAtBlanks: true });
      player.cancel();
    }).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
