// data.worker.js
// Runs OFF the main thread — handles JSON parsing and data sanitization
// to avoid blocking user interactions (reduces INP).

const TOEIC_CATEGORIES = new Set([
  "Contracts", "Marketing", "Warranties", "Business Planning", "Conferences",
  "Computers", "Office Technology", "Office Procedures", "Electronics", "Correspondence",
  "Job Advertising and Recruiting", "Applying and Interviewing", "Hiring and Training",
  "Salaries and Benefits", "Promotions, Pensions, and Awards", "Shopping",
  "Ordering Supplies", "Shipping", "Invoices", "Inventory", "Banking",
  "Accounting", "Investments", "Taxes", "Financial Statements", "Property and Departments",
  "Board Meeting and Committees", "Quality Control", "Product Development",
  "Renting and Leasing", "Selecting a Restaurant", "Eating Out", "Ordering Lunch",
  "Cooking as a Career", "Events", "General Travel", "Airlines", "Trains", "Hotels",
  "Car Rentals", "Movies", "Theater", "Music", "Museums", "Media",
  "Doctors Office", "Dentists Office", "Health Insurance", "Hospitals", "Pharmacy"
]);

const UNCONFIRMED_MARKER = '미확인';

/**
 * Audit and sanitize a single word entry
 */
function sanitizeToeicWord(rawWord) {
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

  return {
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

function sanitizeToeicData(words) {
  if (!Array.isArray(words)) return [];
  return words.map(sanitizeToeicWord).filter(Boolean);
}

self.onmessage = function(event) {
  const payload = event.data;
  
  // New path: raw JSON string — parse + sanitize in Worker (off main thread)
  // This is the primary path for INP optimization: the main thread NEVER
  // does JSON.parse(243KB), only this Worker does.
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      const sanitized = sanitizeToeicData(parsed);
      self.postMessage(sanitized);
    } catch (err) {
      self.postMessage({ __error: true, message: err.message });
    }
    return;
  }
  
  // Legacy path: pre-parsed array (backward compatibility)
  if (Array.isArray(payload)) {
    const sanitizedData = sanitizeToeicData(payload);
    self.postMessage(sanitizedData);
    return;
  }
  
  // Unknown payload
  self.postMessage({ __error: true, message: 'Unknown payload type' });
};
