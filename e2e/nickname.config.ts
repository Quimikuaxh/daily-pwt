import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import base from '../playwright.config'

// Build aislado con un dominio reservado; nickname.case.ts intercepta toda su API.
// Ejecutar por separado de la batería habitual: ambos usan dist-e2e y su puerto.
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer!
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'nickname.case.ts',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'webkit', use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-360', use: { browserName: 'chromium', viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [{ ...server, cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...server.env, VITE_SUPABASE_URL: 'https://vs-account.invalid', VITE_SUPABASE_ANON_KEY: 'test-public-key' } }],
})
