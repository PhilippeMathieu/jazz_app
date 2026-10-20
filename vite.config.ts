/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/jazz_app/',
  plugins: [
    preact(),
    VitePWA({
      // Mise à jour appliquée sur l'accueil, jamais au milieu d'un exercice (src/core/app/pwa.ts).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Harmonie jazz',
        short_name: 'Harmonie',
        description: 'Lire, analyser, entendre et improviser sur des grilles de jazz.',
        lang: 'fr',
        id: '/jazz_app/',
        start_url: '/jazz_app/',
        scope: '/jazz_app/',
        display: 'standalone',
        // Libre : le mode pupitre se lit en paysage (Android applique l'orientation du manifeste).
        orientation: 'any',
        background_color: '#0d121d',
        theme_color: '#0d121d',
        categories: ['music', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,mp3}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ],
  test: { include: ['src/**/*.test.ts'] }
});
