import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../i18n/en.json';
import ru from '../i18n/ru.json';
import ko from '../i18n/ko.json';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const languages = { en, ru, ko };

// Values that are legitimately the same in every language (branding, symbols,
// theme codes and the confirmation word check, which matches what the user types).
const SAME_AS_ENGLISH = ['credits', 'exit', 'email', 'theme_3310', 'delete_word_matches', 'toeic_mistakes_title'];

/** Keys referenced from the markup: data-i18n, -placeholder, -title, -aria. */
function keysFromHtml() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-placeholder|-title|-aria)?="([^"]+)"/g)) {
    keys.add(m[1]);
  }
  return keys;
}

/**
 * String literals passed to t(...) in the modules — `t('next')`, but also the
 * conditional lookups such as `t(soundOn ? 'on' : 'off')`.
 */
function keysFromModule(file) {
  const js = fs.readFileSync(path.join(root, file), 'utf8');
  const keys = new Set();
  for (const call of js.matchAll(/(?<![A-Za-z0-9_$])t\(([^()]*)\)/g)) {
    for (const literal of call[1].matchAll(/'([^']+)'/g)) {
      if (/^[a-z0-9_]+$/i.test(literal[1])) keys.add(literal[1]);
    }
  }
  return keys;
}

const referencedKeys = () => [...new Set([
  ...keysFromHtml(),
  ...keysFromModule('app.js'),
  ...keysFromModule('ui.js'),
])].sort();

describe('translations', () => {
  it('keeps the same keys in every language', () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(ru).sort()).toEqual(keys);
    expect(Object.keys(ko).sort()).toEqual(keys);
  });

  it('has no empty or non-string values', () => {
    for (const [lang, table] of Object.entries(languages)) {
      for (const [key, value] of Object.entries(table)) {
        expect(typeof value, `${lang}.${key} must be a string`).toBe('string');
        expect(value.trim(), `${lang}.${key} must not be empty`).not.toBe('');
      }
    }
  });

  it('covers every key referenced from index.html and app.js', () => {
    const missing = [];
    for (const key of referencedKeys()) {
      for (const [lang, table] of Object.entries(languages)) {
        if (!(key in table)) missing.push(`${lang}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('translates the mode chooser screen (regression guard)', () => {
    const modeKeys = ['select_mode', 'word_quiz', 'word_quiz_sub', 'toeic_tests', 'toeic_tests_sub'];
    for (const key of modeKeys) {
      expect(en[key], `en.${key}`).toBeTruthy();
      expect(ru[key], `ru.${key}`).toBeTruthy();
      expect(ko[key], `ko.${key}`).toBeTruthy();
    }
    // The reported bug looked like "the menu shows English / raw keys":
    // Russian and Korean must actually differ from the English wording.
    for (const key of modeKeys) {
      expect(ru[key], `ru.${key} must not be English`).not.toBe(en[key]);
      expect(ko[key], `ko.${key} must not be English`).not.toBe(en[key]);
    }
  });

  it('does not silently fall back to English', () => {
    for (const [lang, table] of Object.entries(languages)) {
      if (lang === 'en') continue;
      const untranslated = Object.keys(en).filter(
        (key) => table[key] === en[key] && !SAME_AS_ENGLISH.includes(key)
      );
      expect(untranslated, `${lang} still uses the English string`).toEqual([]);
    }
  });
});
