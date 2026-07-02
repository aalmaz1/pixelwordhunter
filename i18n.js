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
  } else if (import.meta.env.BASE_URL) {
    // Fallback to Vite's BASE_URL if available (e.g., in dev mode)
    basePath = import.meta.env.BASE_URL;
  }

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
  const subpathMatch = currentPathname.match(/^\/(.*?)\//); // Matches /subpath/
  if (subpathMatch && subpathMatch[1] && basePath === '/') {
    // If current pathname is /pwhbeta/index.html and basePath is '/',
    // then we should use /pwhbeta/
    basePath = `/${subpathMatch[1]}/`;
  }

  return basePath;
}

const I18nManager = {
  currentLang: 'en',
  supportedLanguages: ['en', 'ru', 'ko'],
  loadedLanguages: new Set(),
  translations: {},
  loadPromises: new Map(),
  
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
  },
  
  async loadLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      throw new Error(`Unsupported language: ${lang}`);
    }
    
    if (this.loadedLanguages.has(lang)) return this.translations[lang];
    if (this.loadPromises.has(lang)) return this.loadPromises.get(lang);
    
    const loadPromise = (async () => {
      try {
        // Use getBasePath() to construct the URL
        const basePath = getBasePath();
        // Try the assets/i18n path first (for production build)
        let url = `${basePath}assets/i18n/${lang}.json`;
        let response = await fetch(url);
        
        // If that fails, try the i18n path (for development)
        if (!response.ok) {
          url = `${basePath}i18n/${lang}.json`;
          response = await fetch(url);
        }
        
        if (!response.ok) throw new Error(`Failed to load translations for ${lang}`);
        
        this.translations[lang] = await response.json();
        this.loadedLanguages.add(lang);
        return this.translations[lang];
      } catch (error) {
        console.error(`Error loading ${lang} translations:`, error);
        // Fallback to English if available
        if (lang !== 'en' && !this.loadedLanguages.has('en')) {
          try {
            await this.loadLanguage('en');
          } catch (enError) {
            console.error('Failed to load English fallback:', enError);
          }
        }
        // Don't rethrow - allow app to continue with empty translations
        this.translations[lang] = {};
        this.loadedLanguages.add(lang);
        return {};
      } finally {
        this.loadPromises.delete(lang);
      }
    })();
    
    this.loadPromises.set(lang, loadPromise);
    return loadPromise;
  },
  
  async setLanguage(lang) {
    if (!this.supportedLanguages.includes(lang) || lang === this.currentLang) return;
    
    // Load the new language if not already loaded
    await this.loadLanguage(lang);
    
    this.currentLang = lang;
    localStorage.setItem('pixelWordHunter_language', lang);
    this.applyLanguage(lang);
    
    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  },
  
  applyLanguage(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ko' || lang === 'en' ? 'ltr' : 'ltr';
    
    // Remove all language classes from body
    document.body.classList.remove('lang-en', 'lang-ru', 'lang-ko');
    
    // Add the current language class to body for font switching
    document.body.classList.add(`lang-${lang}`);
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (key.startsWith('enter_')) {
          el.placeholder = translation;
        }
      } else {
        el.textContent = translation;
      }
    });
    
    // Update placeholders with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });
    
    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });
    
    // Update aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', this.t(key));
    });
  },
  
  t(key) {
    return this.translations[this.currentLang]?.[key] || 
           this.translations.en?.[key] || 
           key;
  },
  
  getCurrentLanguage() {
    return this.currentLang;
  },
  
  getSupportedLanguages() {
    return this.supportedLanguages;
  },
  
  isLanguageLoaded(lang) {
    return this.loadedLanguages.has(lang);
  },
  
  getLoadedLanguages() {
    return Array.from(this.loadedLanguages);
  }
};

// Helper function for templates
export function t(key) {
  return I18nManager.t(key);
}

export { I18nManager };