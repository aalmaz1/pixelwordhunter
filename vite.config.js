import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wordsJsonPath = path.resolve(__dirname, 'public', 'words_optimized.json');
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
    // The firebase-sdk chunk is ~520 KiB by design (whole Firebase SDK,
    // loaded only at login and kept out of the PWA precache).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks(id) {
          // The Firebase SDK (auth + firestore) is only loaded dynamically
          // when the user signs in. Collect it into one deterministically
          // named chunk so the PWA can keep it out of the precache — see
          // workbox.globIgnore below. Signing in needs the network anyway,
          // so this changes nothing for the user.
          if (/node_modules[\\/](@firebase|firebase)\//.test(id)) return 'firebase-sdk';
        }
      }
    }
  },
  // Runtime-only assets in public/ are served as-is in development and copied
  // to dist/ for production. The dictionary has one canonical copy there.
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
      // Emit PWA icons at stable, unhashed paths so the manifest resolves them.
      name: 'copy-pwa-assets',
      closeBundle() {
        try {
          const destDir = path.resolve(__dirname, 'dist/assets');
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const files = ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
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
        description: 'TOEIC business English game with 600 contextual cards and adaptive spaced practice',
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
        // i18n JSON files are copied into dist/assets/i18n by the plugin above.
        // Precache them explicitly so a first successful online load guarantees
        // that every interface language remains available offline. The large
        // word-bank JSON keeps its separately versioned entry below.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2}',
          'assets/i18n/*.json'
        ],
        // The Firebase SDK chunk is intentionally NOT precached: it is only
        // fetched when the user opens login, and login can only succeed with
        // a network connection to the Firebase APIs. Excluding ~500 KiB of
        // rarely used JS keeps first installs fast; offline gameplay (the
        // common case) is fully covered by the precache.
        globIgnores: ['assets/firebase-sdk-*.js'],
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
          }
        ]
      }
    })
  ]
});