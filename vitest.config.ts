import { defineConfig } from 'vitest/config'

// jsdom solo para *.test.tsx (componentes y hooks con RTL); Node para el resto.
// Las pruebas e2e (Playwright) viven en e2e/ y no las recoge Vitest.
export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
})
