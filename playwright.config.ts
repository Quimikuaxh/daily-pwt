import { defineConfig, devices } from '@playwright/test'

/**
 * E2E (docs/PLAN-PRUEBAS-F1.md §4). Dos builds estáticos servidos con `vite preview`:
 * - dist-e2e: con VITE_TEST_HOOKS=1 (ganchos ?date=, ?seed=, ?ai=trivial). Es el que usan casi todos los casos.
 * - dist-e2e-prod: sin ganchos, solo para E2E-17.
 * Los directorios van aparte de `dist/` para no pisar el build real y están en .gitignore.
 * Puertos configurables con E2E_PORT / E2E_PORT_PROD si los de por defecto están ocupados.
 */
const PORT = Number(process.env.E2E_PORT ?? 4391)
const PORT_PROD = Number(process.env.E2E_PORT_PROD ?? 4392)
const HOST = '127.0.0.1'

const server = (outDir: string, port: number, env: Record<string, string>) => ({
  command: `npx vite build --outDir ${outDir} --emptyOutDir && npx vite preview --outDir ${outDir} --host ${HOST} --port ${port} --strictPort`,
  url: `http://${HOST}:${port}/`,
  env,
  reuseExistingServer: false,
  timeout: 180_000,
  stdout: 'ignore' as const,
  stderr: 'ignore' as const,
})

const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
  { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /mobile\.spec\.ts/ },
  {
    // RNF-03: 360x740 táctil. Solo el spec móvil.
    name: 'mobile-360',
    use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } },
    testMatch: /mobile\.spec\.ts/,
  },
]
// Firefox es opcional (plan §4 E2E-22): E2E_FIREFOX=1 con `npx playwright install firefox`.
if (process.env.E2E_FIREFOX === '1') {
  projects.push({ name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /mobile\.spec\.ts/ })
}

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects,
  webServer: [
    server('dist-e2e', PORT, { VITE_TEST_HOOKS: '1' }),
    server('dist-e2e-prod', PORT_PROD, { VITE_TEST_HOOKS: '' }),
  ],
})
