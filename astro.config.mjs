// File: astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    imageService: true,
    imagesConfig: {
      domains: ["ykotzsmncvyfveypeevb.supabase.co"],
      sizes: [300, 600, 1080],
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [
      VitePWA({
        // --- PERBAIKAN UTAMA DI SINI ---
        registerType: 'autoUpdate', // SW update otomatis; customer selalu dapat versi terbaru
        // -----------------------------
        injectRegister: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
          skipWaiting: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        },
        manifest: {
          name: 'BJS Racing Store',
          short_name: 'BJS Store',
          description: 'Distributor Spray Paint dan Onderdil Motor Terpercaya',
          theme_color: '#FF7800',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ],
    server: {
      allowedHosts: ['.replit.dev', '.app.github.dev']
    }
  }
});