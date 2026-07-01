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
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pixel Word Hunter',
        short_name: 'Word Hunter',
        description: 'TOEIC Vocabulary Trainer - Learn 600 business English words with adaptive spaced repetition',
        theme_color: '#0a0010',
        background_color: '#0a0010',
        display: 'standalone',
        orientation: 'any',
        start_url: '/', // Изменено с '/pwhbeta/' на '/'
        icons: [
          {
            src: '/assets/logo.png', // Изменено с '/pwhbeta/assets/logo.png' на '/assets/logo.png'
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/assets/logo.png', // Изменено с '/pwhbeta/assets/logo.png' на '/assets/logo.png'
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
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