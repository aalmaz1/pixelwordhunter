/**
 * Quality guard for the shipped TOEIC question bank (toeic_web_app/toeic_database.json).
 *
 * The bank started as a community dataset with hundreds of defects — duplicated
 * questions, misspelled stems, blanks glued to words, dictionary-definition
 * items and "Which sentence is correct ?" drills that do not belong in a TOEIC
 * Part 5 set. It was cleaned up in full (see toeic_web_app/BANK_AUDIT.md and
 * toeic_web_app/rebuild_bank.py); these tests now freeze the *clean* state with
 * zero tolerance, so any new defect fails the suite.
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
const BLANK = '____';

describe('TOEIC question bank quality', () => {
  it('never repeats an option inside a question', () => {
    const offenders = questions
      .filter((q) => new Set(q.options.map(norm)).size !== q.options.length)
      .map((q) => q.id);
    expect(offenders, 'question(s) repeat one of their own options').toEqual([]);
  });

  it('marks its key exactly once', () => {
    const offenders = questions
      .filter((q) => q.options.filter((o) => norm(o) === norm(q.correct)).length !== 1)
      .map((q) => q.id);
    expect(offenders, 'question(s) do not have exactly one matching option').toEqual([]);
  });

  it('contains no duplicate questions', () => {
    const seen = new Map();
    const offenders = [];
    for (const q of questions) {
      const key = `${norm(q.question)}||${q.options.map(norm).sort().join('|')}`;
      if (seen.has(key)) offenders.push([seen.get(key), q.id]);
      else seen.set(key, q.id);
    }
    expect(offenders, 'duplicate question(s) in the bank').toEqual([]);
  });

  it('never glues the blank to a word', () => {
    const offenders = questions
      .filter((q) => /[a-z]{2,}_{2,}|_{2,}[a-z]{2,}/.test(q.question))
      .map((q) => q.id);
    expect(offenders, 'blank glued to the neighbouring word').toEqual([]);
  });

  it('has no stray spaces and no space before punctuation', () => {
    const offenders = [];
    for (const q of questions) {
      const fields = [q.question, ...q.options];
      if (fields.some((f) => f !== f.trim())) offenders.push([q.id, 'leading/trailing space']);
      if (fields.some((f) => /\s{2,}|\s+[?!.,;:]/.test(f))) offenders.push([q.id, 'double space or space before punctuation']);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every question well formed', () => {
    for (const q of questions) {
      expect(Number.isInteger(q.id), `id of question ${q.id}`).toBe(true);
      expect(typeof q.question, `question ${q.id}`).toBe('string');
      expect(q.question.trim(), `question ${q.id} must not be empty`).not.toBe('');
      expect(q.question, `question ${q.id} must contain a blank`).toContain(BLANK);
      expect(Array.isArray(q.options) && q.options.length === 4, `question ${q.id} needs 4 options`).toBe(true);
      expect(q.options.every((o) => typeof o === 'string' && o.trim() !== ''), `question ${q.id} has an empty option`).toBe(true);
      expect(q.options, `the key of question ${q.id} must be one of its options`).toContain(q.correct);
    }
  });

  it('is a TOEIC Part 5 bank: every item is an incomplete sentence', () => {
    const withoutBlank = questions.filter((q) => !q.question.includes(BLANK)).map((q) => q.id);
    expect(withoutBlank, 'dictionary items / items without a blank').toEqual([]);
    const drills = questions
      .filter((q) => /^which (sentence|of the following)/i.test(q.question.trim()))
      .map((q) => q.id);
    expect(drills, '"Which sentence is correct ?" drills').toEqual([]);
  });

  it('uses honest part names and keeps every part at 100 questions', () => {
    const counts = new Map();
    for (const q of questions) counts.set(q.type_id, (counts.get(q.type_id) || 0) + 1);
    expect(bank.categories.length, 'nine practice sets').toBe(9);
    for (const cat of bank.categories) {
      expect(cat.name, `category ${cat.id} name`).toBe(`Part 5 · Set ${cat.id}`);
      expect(counts.get(cat.id), `questions in part ${cat.id}`).toBe(100);
    }
    for (const q of questions) {
      const cat = bank.categories.find((c) => c.id === q.type_id);
      expect(q.category, `question ${q.id} category`).toBe(cat.name);
    }
  });

  it('keeps the standalone copy (toeic_data.js) in sync with the JSON', () => {
    const js = fs.readFileSync(path.join(root, 'toeic_web_app/toeic_data.js'), 'utf8');
    const match = js.match(/const TOEIC_DATA = ([\s\S]*?);\s*$/);
    expect(match, 'toeic_data.js should still expose `const TOEIC_DATA = {...};`').toBeTruthy();
    expect(JSON.parse(match[1]), 'toeic_data.js drifted from toeic_database.json').toEqual(bank);
  });
});
