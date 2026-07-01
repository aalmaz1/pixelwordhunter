import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: '.',
  base: './', // Уже изменено
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