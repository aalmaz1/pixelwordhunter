/**
 * Quality guard for the shipped TOEIC question bank (toeic_web_app/toeic_database.json).
 *
 * The bank is a community dataset with a number of known defects (see
 * toeic_web_app/BANK_AUDIT.md). This test freezes the *current* number of known
 * offenders so the bank cannot get worse while it is being cleaned up: every
 * check compares against an allowlist of known-bad ids, so fixing the data is
 * allowed and a new defect fails the suite.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankPath = path.join(root, 'toeic_web_app/toeic_database.json');
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const questions = bank.questions;

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

// Known defects, tracked in toeic_web_app/BANK_AUDIT.md — shrink these lists when
// the corresponding questions are fixed or removed.
const KNOWN_REPEATED_OPTION = [70, 102, 149, 229, 258];
const KNOWN_DUPLICATED_KEY = [70, 258]; // #258 only because the two options differ in letter case
const KNOWN_DUPLICATE_PAIRS = [
  [307, 803], // same question + same answer in two different parts
  [857, 878], // same sentence twice inside part 9
  [869, 877], // same sentence twice inside part 9
  [573, 576], // same prompt word twice inside part 6
];
const KNOWN_EMPTY_OPTION = [869]; // options[0] is "" — the corrupted twin of #877
const KNOWN_GLUED_BLANK_COUNT = 55; // "man____________ only"
const KNOWN_TRAILING_SPACE_FIELDS = 224;

const idsWithRepeatedOption = () =>
  questions.filter((q) => new Set(q.options.map(norm)).size !== q.options.length).map((q) => q.id);

const gluedBlankCount = () =>
  questions.filter((q) => /[a-z]{2,}_{2,}|_{2,}[a-z]{2,}/.test(q.question)).length;

const trailingSpaceFields = () =>
  questions.reduce(
    (n, q) => n + (/^\s|\s$/.test(q.question) ? 1 : 0) + q.options.filter((o) => /^\s|\s$/.test(o)).length,
    0
  );

describe('TOEIC question bank quality', () => {
  it('has no repeated options beyond the known list', () => {
    const offenders = idsWithRepeatedOption();
    const unexpected = offenders.filter((id) => !KNOWN_REPEATED_OPTION.includes(id));
    expect(unexpected, 'new question(s) repeat one of their own options').toEqual([]);
  });

  it('never marks an option key twice beyond the known list', () => {
    const offenders = questions
      .filter((q) => q.options.filter((o) => norm(o) === norm(q.correct)).length > 1)
      .map((q) => q.id);
    const unexpected = offenders.filter((id) => !KNOWN_DUPLICATED_KEY.includes(id));
    expect(unexpected, 'new question(s) duplicate their own correct answer').toEqual([]);
  });

  it('has no duplicate question + answer pairs beyond the known list', () => {
    const seen = new Map();
    const offenders = [];
    for (const q of questions) {
      const key = `${norm(q.question)}||${norm(q.correct)}`;
      if (seen.has(key)) offenders.push([seen.get(key), q.id]);
      else seen.set(key, q.id);
    }
    const known = new Set(KNOWN_DUPLICATE_PAIRS.map((pair) => pair.join('-')));
    const unexpected = offenders.filter((pair) => !known.has(pair.join('-')) && !known.has([...pair].reverse().join('-')));
    expect(unexpected, 'new duplicate question(s) in the bank').toEqual([]);
  });

  it('does not grow the number of blanks glued to a word', () => {
    expect(gluedBlankCount()).toBeLessThanOrEqual(KNOWN_GLUED_BLANK_COUNT);
  });

  it('does not grow the number of fields with stray spaces', () => {
    expect(trailingSpaceFields()).toBeLessThanOrEqual(KNOWN_TRAILING_SPACE_FIELDS);
  });

  it('keeps every question well formed', () => {
    for (const q of questions) {
      expect(Number.isInteger(q.id), `id of question ${q.id}`).toBe(true);
      expect(typeof q.question, `question ${q.id}`).toBe('string');
      expect(q.question.trim(), `question ${q.id} must not be empty`).not.toBe('');
      expect(Array.isArray(q.options) && q.options.length === 4, `question ${q.id} needs 4 options`).toBe(true);
      if (!KNOWN_EMPTY_OPTION.includes(q.id)) {
        expect(q.options.every((o) => typeof o === 'string' && o.trim() !== ''), `question ${q.id} has an empty option`).toBe(true);
      }
      expect(q.options, `the key of question ${q.id} must be one of its options`).toContain(q.correct);
    }
  });

  it('keeps the standalone copy (toeic_data.js) in sync with the JSON', () => {
    const js = fs.readFileSync(path.join(root, 'toeic_web_app/toeic_data.js'), 'utf8');
    const match = js.match(/const TOEIC_DATA = ([\s\S]*?);\s*$/);
    expect(match, 'toeic_data.js should still expose `const TOEIC_DATA = {...};`').toBeTruthy();
    expect(JSON.parse(match[1]), 'toeic_data.js drifted from toeic_database.json').toEqual(bank);
  });
});
