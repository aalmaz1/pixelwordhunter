// data.worker.js

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
  
  // Stricter translation checks
  const rus = typeof rawWord.rus === 'string' && rawWord.rus.trim() ? rawWord.rus.trim() : '';
             
  const kor = typeof rawWord.kor === 'string' && rawWord.kor.trim() ? rawWord.kor.trim() : 
             (typeof rawWord.ko === 'string' && rawWord.ko.trim() ? rawWord.ko.trim() : '');
  
  const exampleEng = typeof rawWord.exampleEng === 'string' ? rawWord.exampleEng.trim() : '';
  const exampleRus = typeof rawWord.exampleRus === 'string' ? rawWord.exampleRus.trim() : '';
  const exampleKor = typeof rawWord.exampleKor === 'string' && rawWord.exampleKor.trim() ? rawWord.exampleKor.trim() : 
                    (typeof rawWord.exampleKo === 'string' && rawWord.exampleKo.trim() ? rawWord.exampleKo.trim() : '');

  // Validation: mandatory fields
  if (!eng || (!rus && !kor)) {
    // console.warn(`[Data Audit] Invalid word entry: missing eng or translation`, rawWord); // Log in worker might be noisy
    return null;
  }

  // Audit: Category check
  if (!TOEIC_CATEGORIES.has(category)) {
    // console.warn(`[Data Audit] Unknown category: ${category} for word ${eng}`); // Log in worker might be noisy
  }

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
  const sanitized = words.map(sanitizeToeicWord).filter(Boolean);
  // console.log(`[Data Audit] Processed ${words.length} words, ${sanitized.length} valid entries found.`); // Log in worker might be noisy
  return sanitized;
}

self.onmessage = function(event) {
  const rawData = event.data;
  const sanitizedData = sanitizeToeicData(rawData);
  self.postMessage(sanitizedData);
};
