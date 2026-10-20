import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/', 'dist-e2e/', 'dist-e2e-prod/', 'e2e-artifacts/', 'coverage/', 'node_modules/', 'public/', 'test-results/', 'playwright-report/', 'scripts/.cache/', 'src/generated/'] },
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023 },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test-utils/**', 'e2e/**', 'vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)
