// sanitize.js
// Shared sanitizer used by both the Web Worker (data.worker.js) and the
// main-thread fallback path (data.js). Keep this file dependency-free so
// it can be imported from either environment without pulling in DOM APIs.

export const UNCONFIRMED_MARKER = '미확인';

export function sanitizeToeicWord(rawWord) {
  if (!rawWord || typeof rawWord !== 'object') return null;

  const eng = typeof rawWord.eng === 'string' ? rawWord.eng.trim() : '';
  const category = typeof rawWord.category === 'string' ? rawWord.category.trim() : 'General';

  const rus = typeof rawWord.rus === 'string' && rawWord.rus.trim() ? rawWord.rus.trim() : '';
  const kor = typeof rawWord.kor === 'string' && rawWord.kor.trim() ? rawWord.kor.trim() :
              (typeof rawWord.ko === 'string' && rawWord.ko.trim() ? rawWord.ko.trim() : '');

  const exampleEng = typeof rawWord.exampleEng === 'string' ? rawWord.exampleEng.trim() : '';
  const exampleRus = typeof rawWord.exampleRus === 'string' ? rawWord.exampleRus.trim() : '';
  const exampleKor = typeof rawWord.exampleKor === 'string' && rawWord.exampleKor.trim() ? rawWord.exampleKor.trim() :
                     (typeof rawWord.exampleKo === 'string' && rawWord.exampleKo.trim() ? rawWord.exampleKo.trim() : '');

  if (!eng || (!rus && !kor)) return null;

  const id = typeof rawWord.id === 'string' && rawWord.id.trim()
    ? rawWord.id.trim()
    : `${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}--${eng.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

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
