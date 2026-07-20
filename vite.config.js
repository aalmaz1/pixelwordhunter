import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    sourcemap: true, // Generate source maps for production debugging
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  plugins: [
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
          {
            src: '/assets/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/assets/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
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
          { url: 'words_optimized.json', revision: null }
        ],
        runtimeCaching: [
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