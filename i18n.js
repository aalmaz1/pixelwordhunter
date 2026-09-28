// i18n - Internationalization module for Pixel Word Hunter
// Lazy loading implementation for translations

// Helper function to get the base path dynamically
function getBasePath() {
  // Use window.location.origin to get the protocol, hostname, and port
  // Then append the base path from the <base> tag, if it's explicitly set.
  // If <base> tag is not used or href is '/', we assume root.
  const baseTag = document.querySelector('base');
  let basePath = '/'; // Default to root

  if (baseTag && baseTag.href) {
    // Extract pathname from baseTag.href
    const url = new URL(baseTag.href);
    basePath = url.pathname;
  } else if (import.meta.env?.BASE_URL) {
    // Fallback to Vite's BASE_URL if available (e.g., in dev mode)
    basePath = import.meta.env.BASE_URL;
  }

  // The build uses base: './', so BASE_URL arrives as './'. Left as is it
  // produced URLs like '/./assets/i18n/ru.json' — servers normalize those,
  // but nothing guaranteed it, so collapse the current-directory segments.
  basePath = basePath.replace(/(^|\/)\.(?=\/|$)/g, '$1');

  // Ensure basePath ends with a slash and starts with one (unless it's empty)
  if (basePath && !basePath.endsWith('/')) {
    basePath += '/';
  }
  if (basePath && !basePath.startsWith('/')) {
    basePath = `/${basePath}`;
  }

  // For local testing with npx serve dist, base might be './' which resolves to root.
  // We need to ensure that if the app is served from a subpath (like /pwhbeta/),
  // the basePath reflects that.
  // This logic is a bit tricky with dynamic serving.
  // Let's try to infer from window.location.pathname if it's a subpath.
  const currentPathname = window.location.pathname;
  const subpathMatch = currentPathname.match(/^\/([^/]+)\//); // Matches /subpath/
  if (subpathMatch && subpathMatch[1] && basePath === '/') {
    // If current pathname is /pwhbeta/index.html and basePath is '/',
    // then we should use /pwhbeta/
    basePath = `/${subpathMatch[1]}/`;
  }

  return basePath;
}

/**
 * Fetch one translation table.
 *
 * Returns the parsed object, or null when the URL is missing. A dev server
 * answers unknown paths with the index.html fallback (HTTP 200 + text/html),
 * and parsing that as JSON used to throw away the whole language, so anything
 * that is not a JSON object counts as a miss and lets the caller try the next
 * candidate URL.
 */
async function fetchTranslationTable(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType && !/json/i.test(contentType)) return null;

    const table = await response.json();
    if (!table || typeof table !== 'object' || Array.isArray(table)) return null;
    return Object.keys(table).length > 0 ? table : null;
  } catch {
    return null; // network error, HTML body, malformed JSON — all a miss
  }
}

const I18nManager = {
  currentLang: 'en',
  supportedLanguages: ['en', 'ru', 'ko'],
  loadedLanguages: new Set(),
  translations: {},
  loadPromises: new Map(),
  // Original markup texts per element/attribute, captured before the first
  // translation overwrites them. Used as the last-resort fallback so a missing
  // key shows the built-in English label ("// SELECT MODE //") instead of the
  // raw key ("select_mode").
  markupDefaults: new WeakMap(),

  async init() {
    const savedLang = localStorage.getItem('pixelWordHunter_language');
    if (savedLang && this.supportedLanguages.includes(savedLang)) {
      this.currentLang = savedLang;
    } else {
      // Detect browser language
      const browserLang = navigator.language.slice(0, 2);
      if (this.supportedLanguages.includes(browserLang)) {
        this.currentLang = browserLang;
      }
    }

    // Load the initial language
    await this.loadLanguage(this.currentLang);
    this.applyLanguage(this.currentLang);
    this.retryWhenOnline();
  },

  /**
   * Candidate URLs for one language, most likely first.
   *
   * Development serves the repository's i18n/ directory straight from disk;
   * the production build copies the very same files to assets/i18n/ (see the
   * copy-i18n plugin in vite.config.js). Both orders are harmless thanks to
   * fetchTranslationTable(), which turns a miss into "try the next one".
   */
  candidatePaths(lang) {
    const basePath = getBasePath();
    return import.meta.env?.DEV
      ? [`${basePath}i18n/${lang}.json`, `${basePath}assets/i18n/${lang}.json`]
      : [`${basePath}assets/i18n/${lang}.json`, `${basePath}i18n/${lang}.json`];
  },

  async loadLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      throw new Error(`Unsupported language: ${lang}`);
    }

    if (this.loadedLanguages.has(lang)) return this.translations[lang];
    if (this.loadPromises.has(lang)) return this.loadPromises.get(lang);

    const loadPromise = (async () => {
      for (const url of this.candidatePaths(lang)) {
        const table = await fetchTranslationTable(url);
        if (table) {
          this.translations[lang] = table;
          this.loadedLanguages.add(lang);
          return table;
        }
      }

      console.warn(`[i18n] Could not load translations for "${lang}"`);
      // Fallback to English if available
      if (lang !== 'en') {
        try {
          await this.loadLanguage('en');
        } catch (enError) {
          console.error('Failed to load English fallback:', enError);
        }
      }
      // Deliberately NOT marked as loaded: a later init()/setLanguage() can
      // retry instead of being stuck with an empty table forever.
      return this.translations[lang] || null;
    })();

    this.loadPromises.set(lang, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.loadPromises.delete(lang);
    }
  },

  /**
   * A first visit can fail offline or through a flaky network. Retry once the
   * connection is back so the UI does not stay on the English defaults.
   */
  retryWhenOnline() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('online', async () => {
      if (this.loadedLanguages.has(this.currentLang)) return;
      const table = await this.loadLanguage(this.currentLang);
      if (table) this.applyLanguage(this.currentLang);
    });
  },

  async setLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) return;
    // Re-selecting the current language is allowed while it is not loaded yet,
    // so the language buttons double as a retry after a failed download.
    if (lang === this.currentLang && this.loadedLanguages.has(lang)) return;

    // Load the new language if not already loaded
    await this.loadLanguage(lang);

    this.currentLang = lang;
    localStorage.setItem('pixelWordHunter_language', lang);
    this.applyLanguage(lang);

    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  },

  /** Remember the markup text once, before the first translation replaces it. */
  rememberMarkupDefault(el, prop) {
    let saved = this.markupDefaults.get(el);
    if (!saved) {
      saved = {};
      this.markupDefaults.set(el, saved);
    }
    if (!(prop in saved)) {
      saved[prop] = prop === 'text' ? el.textContent : (el.getAttribute(prop) ?? '');
    }
    return saved[prop];
  },

  /** Translated value for a key, or null when no loaded language has it. */
  lookup(key) {
    const primary = this.translations[this.currentLang];
    if (primary && typeof primary[key] === 'string' && primary[key] !== '') return primary[key];

    const fallback = this.translations.en;
    if (fallback && typeof fallback[key] === 'string' && fallback[key] !== '') return fallback[key];

    return null;
  },

  /** Write a translation into the DOM, restoring the markup default if unknown. */
  setTranslatedText(el, key, prop) {
    const value = this.lookup(key);
    if (value === null) {
      // Unknown key everywhere: keep/restore the built-in English markup text.
      const defaultText = this.markupDefaults.get(el)?.[prop];
      if (defaultText === undefined || defaultText === '') return;
      if (prop === 'text') el.textContent = defaultText;
      else el.setAttribute(prop, defaultText);
      return;
    }
    if (prop === 'text') el.textContent = value;
    else el.setAttribute(prop, value);
  },

  applyLanguage(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';

    // Remove all language classes from body
    document.body.classList.remove('lang-en', 'lang-ru', 'lang-ko');

    // Add the current language class to body for font switching
    document.body.classList.add(`lang-${lang}`);

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (!key.startsWith('enter_')) return;
        this.rememberMarkupDefault(el, 'placeholder');
        this.setTranslatedText(el, key, 'placeholder');
      } else if (el.children.length === 0) {
        // Skip nodes with markup (e.g. PIXEL<br>WORD<br>HUNTER) so i18n
        // does not flatten the title into a single line.
        this.rememberMarkupDefault(el, 'text');
        this.setTranslatedText(el, key, 'text');
      }
    });

    // Update placeholders with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      this.rememberMarkupDefault(el, 'placeholder');
      this.setTranslatedText(el, el.getAttribute('data-i18n-placeholder'), 'placeholder');
    });

    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      this.rememberMarkupDefault(el, 'title');
      this.setTranslatedText(el, el.getAttribute('data-i18n-title'), 'title');
    });

    // Update aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      this.rememberMarkupDefault(el, 'aria-label');
      this.setTranslatedText(el, el.getAttribute('data-i18n-aria'), 'aria-label');
    });
  },

  t(key) {
    // The key itself is the last resort: callers in app.js keep their own
    // English fallbacks (e.g. `t('import_success') || 'Import successful'`).
    const value = this.lookup(key);
    return value === null ? key : value;
  },

  getCurrentLanguage() {
    return this.currentLang;
  }
};

export { I18nManager };
