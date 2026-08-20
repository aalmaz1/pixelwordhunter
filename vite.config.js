import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wordsJsonPath = path.resolve(__dirname, 'words_optimized.json');
const wordsDataRevision = fs.existsSync(wordsJsonPath)
  ? crypto.createHash('sha256').update(fs.readFileSync(wordsJsonPath)).digest('hex').slice(0, 16)
  : 'dev';
const wordsDataUrl = `words_optimized.json?v=${wordsDataRevision}`;

export default defineConfig({
  define: {
    __WORDS_DATA_REVISION__: JSON.stringify(wordsDataRevision)
  },
  root: '.',
  base: './',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', 'localhost']
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', 'localhost']
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  // Ensure words_optimized.json is served as a static file in dev mode
  // so fetch('./words_optimized.json') works during development.
  publicDir: 'public',
  plugins: [
    {
      name: 'copy-robots-txt',
      closeBundle() {
        try {
          const srcFile = path.resolve(__dirname, 'robots.txt');
          const destFile = path.resolve(__dirname, 'dist/robots.txt');
          
          if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
            console.log('✅ robots.txt copied to dist/');
          } else {
            console.warn('⚠️ robots.txt not found in source');
          }
        } catch (err) {
          console.error('❌ Failed to copy robots.txt:', err);
        }
      }
    },
    {
      name: 'copy-i18n',
      closeBundle() {
        try {
          const srcDir = path.resolve(__dirname, 'i18n');
          const destDir = path.resolve(__dirname, 'dist/assets/i18n');
          
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          
          const files = fs.readdirSync(srcDir);
          files.forEach(file => {
            fs.copyFileSync(
              path.join(srcDir, file),
              path.join(destDir, file)
            );
          });
          console.log('✅ i18n files copied to dist/assets/i18n');
        } catch (err) {
          console.error('❌ Failed to copy i18n files:', err);
        }
      }
    },
    {
      name: 'copy-words-json',
      closeBundle() {
        try {
          const srcFile = path.resolve(__dirname, 'words_optimized.json');
          const destFile = path.resolve(__dirname, 'dist/words_optimized.json');
          
          if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
            console.log('✅ words_optimized.json copied to dist/');
          } else {
            console.warn('⚠️ words_optimized.json not found in source');
          }
        } catch (err) {
          console.error('❌ Failed to copy words_optimized.json:', err);
        }
      }
    },
    {
      // Emit PWA icons at STABLE, unhashed paths so the manifest resolves them
      // in production. Vite would otherwise hash any file referenced from
      // index.html and break manifest lookups.
      name: 'copy-pwa-assets',
      closeBundle() {
        try {
          const destDir = path.resolve(__dirname, 'dist/assets');
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const files = ['logo.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
          for (const f of files) {
            const src = path.resolve(__dirname, 'assets', f);
            const dst = path.resolve(destDir, f);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dst);
              console.log(`✅ ${f} copied to dist/assets/`);
            }
          }
        } catch (err) {
          console.error('❌ Failed to copy PWA assets:', err);
        }
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // Disable auto-injection of registerSW script
      manifest: {
        short_name: 'WordHunter',
        name: 'Pixel Word Hunter',
        description: 'TOEIC vocabulary learning game',
        start_url: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0a0010',
        background_color: '#0a0010',
        categories: ['education', 'games'],
        icons: [
          { src: './assets/icon-192.png',           sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './assets/icon-512.png',           sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: './assets/icon-512-maskable.png',  sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Quick Round', short_name: 'Quick', url: './?action=quick',
            icons: [{ src: './assets/icon-192.png', sizes: '192x192' }] },
          { name: 'Hard Words',  short_name: 'Hard',  url: './?action=hard',
            icons: [{ src: './assets/icon-192.png', sizes: '192x192' }] }
        ],
        prefer_related_applications: false,
        scope: './'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        additionalManifestEntries: [
          // The vocabulary JSON is fetched at runtime, so include the same
          // versioned URL in the precache manifest. Its revision/hash changes
          // whenever words_optimized.json changes, forcing the SW bundle to
          // update and preventing users from being stuck on stale translations.
          { url: wordsDataUrl, revision: wordsDataRevision }
        ],
        runtimeCaching: [
          {
            // Keep one last-good copy for offline use, but prefer the network
            // so new sentence translations appear immediately after deployment.
            urlPattern: /words_optimized\.json(?:\?.*)?$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'words-data-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});