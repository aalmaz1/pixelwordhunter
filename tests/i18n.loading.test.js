// @vitest-environment jsdom
/**
 * Runtime loading tests for i18n.js.
 *
 * The reported bug: the // SELECT MODE // screen showed raw keys ("select_mode")
 * instead of translations, because a dev/preview server answers the missing
 * /assets/i18n/<lang>.json with the index.html SPA fallback — HTTP 200, so the
 * loader believed it succeeded, response.json() threw, and the whole language
 * was cached as "loaded" but empty. These tests pin both the dev and the
 * production layout, plus the offline fallback.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TABLES = {
  en: JSON.parse(fs.readFileSync(path.join(root, 'i18n/en.json'), 'utf8')),
  ru: JSON.parse(fs.readFileSync(path.join(root, 'i18n/ru.json'), 'utf8')),
  ko: JSON.parse(fs.readFileSync(path.join(root, 'i18n/ko.json'), 'utf8')),
};

const ok = (table) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json; charset=utf-8' },
  json: async () => table,
});

// The Vite dev server's SPA fallback: unknown paths return index.html with 200.
const htmlFallback = () => ({
  ok: true,
  status: 200,
  headers: { get: () => 'text/html' },
  json: async () => { throw new SyntaxError("Unexpected token '<'"); },
});

const notFound = () => ({
  ok: false,
  status: 404,
  headers: { get: () => 'text/plain' },
  json: async () => { throw new SyntaxError('Unexpected token <'); },
});

const langFromUrl = (url) => String(url).match(/([a-z]{2})\.json/)?.[1];

/** Dev layout: i18n/ is served, assets/i18n/ only exists after a build. */
const devServer = async (url) => {
  const lang = langFromUrl(url);
  return String(url).includes('/assets/i18n/') ? htmlFallback() : ok(TABLES[lang]);
};

/** Production layout: the build copied the files to assets/i18n/. */
const prodServer = async (url) => {
  const lang = langFromUrl(url);
  return String(url).includes('/assets/i18n/') ? ok(TABLES[lang]) : notFound();
};

const offlineServer = async () => notFound();

function installMarkup() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
  document.body.className = '';
  document.documentElement.lang = 'en';
}

/** Fresh module instance per test (i18n.js keeps state per import). */
async function freshManager() {
  vi.resetModules();
  const { I18nManager } = await import('../i18n.js');
  return I18nManager;
}

const textOf = (key) => document.querySelector(`[data-i18n="${key}"]`).textContent;
const modeScreenText = () =>
  document.getElementById('mode-screen').textContent.replace(/\s+/g, ' ').trim();

beforeEach(() => {
  installMarkup();
  localStorage.clear();
  localStorage.setItem('pixelWordHunter_language', 'ru');
  navigator.language; // jsdom default ('en-US') is irrelevant: saved lang wins
});

describe('i18n loading', () => {
  it('loads Russian from the dev layout, where assets/i18n/ is an HTML fallback', async () => {
    global.fetch = vi.fn(devServer);
    const I18nManager = await freshManager();
    await I18nManager.init();

    expect(I18nManager.getCurrentLanguage()).toBe('ru');
    expect(I18nManager.t('select_mode')).toBe('// ВЫБЕРИТЕ РЕЖИМ //');
    expect(textOf('select_mode')).toBe('// ВЫБЕРИТЕ РЕЖИМ //');
    expect(modeScreenText()).toContain('КВИЗ СЛОВ');
    expect(modeScreenText()).toContain('ТЕСТЫ TOEIC');
    expect(modeScreenText()).toContain('НАЗАД');
    expect(document.body.classList.contains('lang-ru')).toBe(true);
    // The HTML fallback must not be requested repeatedly.
    expect(global.fetch.mock.calls.map(([u]) => u)).toEqual(['/i18n/ru.json']);
  });

  it('loads Russian from the production layout as well', async () => {
    global.fetch = vi.fn(prodServer);
    const I18nManager = await freshManager();
    await I18nManager.init();

    expect(I18nManager.t('word_quiz')).toBe('КВИЗ СЛОВ');
    expect(textOf('word_quiz_sub')).toBe('ИЗУЧИ 600 СЛОВ');
    // First candidate 404s, so the loader falls through to assets/i18n/.
    const urls = global.fetch.mock.calls.map(([u]) => u);
    expect(urls[urls.length - 1]).toContain('assets/i18n/ru.json');
  });

  it('translates placeholders, titles and aria labels', async () => {
    global.fetch = vi.fn(devServer);
    const I18nManager = await freshManager();
    await I18nManager.init();

    expect(document.getElementById('category-search').placeholder).toBe('ПОИСК...');
    expect(document.getElementById('word').getAttribute('aria-label'))
      .toBe('Нажмите на слово, чтобы услышать его');
  });

  it('keeps the English markup defaults when nothing can be loaded', async () => {
    global.fetch = vi.fn(offlineServer);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const I18nManager = await freshManager();
    await I18nManager.init();

    // Never show raw keys such as "select_mode" to the user.
    expect(textOf('select_mode')).toBe('// SELECT MODE //');
    expect(textOf('word_quiz')).toBe('WORD QUIZ');
    expect(modeScreenText()).not.toContain('select_mode');
    // A failed language is not remembered as loaded, so it can be retried.
    expect(I18nManager.loadedLanguages.has('ru')).toBe(false);
    expect(I18nManager.t('select_mode')).toBe('select_mode'); // plain API fallback
    warn.mockRestore();
  });

  it('retries a failed language when it is selected again', async () => {
    global.fetch = vi.fn(offlineServer);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const I18nManager = await freshManager();
    await I18nManager.init();
    expect(textOf('select_mode')).toBe('// SELECT MODE //');

    // Network is back (or a service worker warmed the cache).
    global.fetch = vi.fn(devServer);
    await I18nManager.setLanguage('ru');

    expect(I18nManager.loadedLanguages.has('ru')).toBe(true);
    expect(textOf('select_mode')).toBe('// ВЫБЕРИТЕ РЕЖИМ //');
    expect(modeScreenText()).toContain('КВИЗ СЛОВ');
    warn.mockRestore();
  });

  it('switches between languages and restores defaults for missing keys', async () => {
    global.fetch = vi.fn(devServer);
    const I18nManager = await freshManager();
    await I18nManager.init();

    await I18nManager.setLanguage('ko');
    expect(I18nManager.t('select_mode')).toBe('// 모드 선택 //');
    expect(textOf('word_quiz')).toBe('단어 퀴즈');
    expect(document.body.classList.contains('lang-ko')).toBe(true);

    await I18nManager.setLanguage('en');
    expect(textOf('select_mode')).toBe('// SELECT MODE //');
    expect(document.body.classList.contains('lang-en')).toBe(true);
  });
});
