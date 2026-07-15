/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// При сборке под Android (Capacitor) service worker не нужен и может мешать
// работе в WebView — ассеты и так упакованы локально. PWA включаем только
// для веб-сборки. Флаг выставляет CI перед `vite build` (CAP_BUILD=1).
const isCapacitor = process.env.CAP_BUILD === '1';

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
  manifest: {
    name: 'DOFFA Games',
    short_name: 'DOFFA',
    description: 'DOFFA Games — премиальная игровая платформа: DOFFA Bean Duel и тапалка «Зёрна»',
    lang: 'ru',
    theme_color: '#16110b',
    background_color: '#16110b',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

export default defineConfig({
  // Относительные пути — нужно для корректной загрузки ассетов из WebView Capacitor.
  base: isCapacitor ? './' : '/',
  plugins: [nodePolyfills(), react(), ...(isCapacitor ? [] : [pwaPlugin])],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion': ['framer-motion'],
          'state': ['zustand'],
          'solana': ['@solana/web3.js'],
        },
      },
    },
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
  },
  test: {
    environment: 'node',
    // server/ — отдельный npm-пакет со своим vitest.config.ts (никакого
    // vite-plugin-node-polyfills там нет и не должно быть); без исключения
    // корневой `vitest run` подхватил бы server/**/*.test.ts через этот же
    // конфиг и упал на резолвинге Node-полифиллов в чисто серверном коде.
    exclude: ['**/node_modules/**', 'server/**'],
  },
});
