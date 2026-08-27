// sanitize.js
// Shared sanitizer used by both the Web Worker (data.worker.js) and the
// main-thread fallback path (data.js). Keep this file dependency-free so
// it can be imported from either environment without pulling in DOM APIs.

export const UNCONFIRMED_MARKER = '미확인';

// words_optimized.json ships a compact single-letter key format to keep the
// file small: i=id, c=category, e=eng, r=rus, E=exampleEng, R=exampleRus,
// k=kor, K=exampleKor. Older/hand-written data may still use the long names
// (plus the very old ko/exampleKo aliases), so every field reads both.
const firstString = (values) => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

function sanitizeToeicWord(rawWord) {
  if (!rawWord || typeof rawWord !== 'object') return null;

  const eng = firstString([rawWord.e, rawWord.eng]);
  const category = firstString([rawWord.c, rawWord.category]) || 'General';

  const rus = firstString([rawWord.r, rawWord.rus]);
  const kor = firstString([rawWord.k, rawWord.kor, rawWord.ko]);

  const exampleEng = firstString([rawWord.E, rawWord.exampleEng]);
  const exampleRus = firstString([rawWord.R, rawWord.exampleRus]);
  const exampleKor = firstString([rawWord.K, rawWord.exampleKor, rawWord.exampleKo]);

  if (!eng || (!rus && !kor)) return null;

  const id = firstString([rawWord.i, rawWord.id]) ||
    `${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}--${eng.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return {
    id,
    eng,
    category,
    rus: rus || 'No translation',
    kor: kor || UNCONFIRMED_MARKER,
    exampleEng,
    exampleRus,
    exampleKor: exampleKor || UNCONFIRMED_MARKER,
    mastery: Number(rawWord.mastery) || 0,
    lastSeen: Number(rawWord.lastSeen) || 0,
    correctCount: Number(rawWord.correctCount) || 0,
    incorrectCount: Number(rawWord.incorrectCount) || 0
  };
}

export function sanitizeToeicData(words) {
  if (!Array.isArray(words)) return [];
  return words.map(sanitizeToeicWord).filter(Boolean);
}
