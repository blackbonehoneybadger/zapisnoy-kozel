import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Записной Козёл',
        short_name: 'Козёл',
        description: 'Премиальная карточная игра «Записной Козёл»',
        lang: 'ru',
        theme_color: '#0b0f0d',
        background_color: '#0b0f0d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
