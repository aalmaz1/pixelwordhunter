/**
 * Shared browser speech player. TOEIC blanks can be rendered as real pauses,
 * rather than leaving the browser's voice to pronounce each underscore.
 */
export const BLANK_PAUSE_MS = 700;

function sentenceChunks(text) {
  // Split long utterances at sentence boundaries, not inside $25.50, P.M.,
  // URLs, or initials.  Common titles and time abbreviations stay with the
  // following words so TTS does not pronounce a stray letter or title alone.
  const chunks = text.match(/[\s\S]+?[.!?]+["'”’)]*(?=\s|$)|[\s\S]+$/g) || [text];
  const result = [];
  let pending = '';
  for (const chunk of chunks) {
    pending += chunk;
    if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|No|vs|[AP]\.M)\.$/i.test(pending.trimEnd())) continue;
    result.push(pending);
    pending = '';
  }
  if (pending) result.push(pending);
  return result;
}

function speechSteps(text, { splitSentences = false, pauseAtBlanks = false } = {}) {
  // Long listening transcripts are split to avoid browser utterance time limits.
  const chunks = splitSentences ? sentenceChunks(text) : [text];
  const steps = [];
  for (const chunk of chunks) {
    if (!pauseAtBlanks || !/_{2,}/.test(chunk)) {
      // Spaced ellipses (". . .") otherwise become standalone utterances,
      // which some voices pronounce as "dot" rather than as a pause.
      if (/[\p{L}\p{N}]/u.test(chunk)) steps.push(chunk);
      continue;
    }
    for (const part of chunk.split(/(_{2,})/)) {
      if (/^_{2,}$/.test(part)) steps.push(null); // a timed, silent gap
      // Do not send a trailing period or other punctuation by itself to TTS.
      else if (/[\p{L}\p{N}]/u.test(part)) steps.push(part.trim());
    }
  }
  return steps;
}

export function createSpeechPlayer(synthesis, Utterance) {
  const supported = !!synthesis && typeof synthesis.speak === 'function' && typeof Utterance === 'function';
  let playbackId = 0;
  let pauseTimer = null;
  let activeUtterance = null;

  function cancel() {
    // Invalidate callbacks before cancelling: some engines may fire an event
    // for the old utterance even after it has been interrupted.
    playbackId += 1;
    activeUtterance = null;
    if (pauseTimer !== null) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
    try { synthesis?.cancel(); } catch { /* speech unavailable */ }
  }

  function speak(text, lang = 'en', options = {}) {
    if (!supported || !text) return;
    cancel();
    const currentPlayback = playbackId;
    const steps = speechSteps(text, options);
    let index = 0;

    const next = () => {
      if (currentPlayback !== playbackId || index >= steps.length) return;
      const step = steps[index++];
      if (step === null) {
        pauseTimer = setTimeout(() => {
          if (currentPlayback !== playbackId) return;
          pauseTimer = null;
          next();
        }, BLANK_PAUSE_MS);
        return;
      }
      try {
        const utterance = new Utterance(step);
        utterance.lang = lang === 'ko' ? 'ko-KR' : lang === 'ru' ? 'ru-RU' : 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        // Keep a reference until the event fires; also ignore duplicate/late
        // events so a cancelled fragment cannot restart an old question.
        activeUtterance = utterance;
        utterance.onend = () => {
          if (currentPlayback !== playbackId || activeUtterance !== utterance) return;
          activeUtterance = null;
          next();
        };
        utterance.onerror = () => {
          if (activeUtterance === utterance) activeUtterance = null;
        };
        synthesis.speak(utterance);
      } catch {
        activeUtterance = null; // speech unavailable — the text stays readable
      }
    };
    next();
  }

  return { supported, speak, cancel };
}
