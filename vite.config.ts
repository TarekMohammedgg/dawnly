/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { dawnlyApiPlugin } from './scripts/vite-api-plugin.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      dawnlyApiPlugin(),
      ...VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script-defer',
        includeAssets: ['favicon.svg', 'pwa-icon-192.svg', 'pwa-icon-512.svg'],
        manifest: {
          id: '/',
          name: 'دفتر ليّا وعليّا',
          short_name: 'دفتر ليّا',
          description: 'دفتر شخصي هادئ لتسجيل المبالغ ليّا وعليّا',
          lang: 'ar',
          dir: 'rtl',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          prefer_related_applications: false,
          theme_color: '#1D5B52',
          background_color: '#F7F5F1',
          icons: [
            {
              src: '/pwa-icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
            {
              src: '/pwa-icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      env: {
        SUPABASE_URL: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY:
          env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY,
        SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
      },
    },
  }
})
