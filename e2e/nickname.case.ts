import { test, expect } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { MISTY } from './support'

// Configuración: npx playwright test --config e2e/nickname.config.ts
// Sesión registrada simulada; ninguna petición llega a Supabase ni a Google.
test('E2E-78 el nickname de la cuenta aparece como texto y nombre accesible en la pancarta VS', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('daily-pwt:auth', JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer',
      expires_at: 4102444800, expires_in: 3600,
      user: { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false },
    }))
  })
  const unexpected: string[] = []
  await page.route('https://vs-account.invalid/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const replies: Record<string, unknown> = {
      '/rest/v1/rpc/ensure_profile': { nickname: 'Jose_11', created: false, registered: true },
      '/rest/v1/rpc/my_days': [],
      '/rest/v1/rpc/my_summary': { nickname: 'Jose_11', registered: true, nicknameChosen: true, points: [], incomingRequests: 0 },
      '/rest/v1/rpc/day_wins': { wins: 0, players: 0 },
      '/rest/v1/rpc/start_official': { created: true, day: null },
      // El oficial con cuenta consulta las solicitudes de directo (RF-111c): ninguna.
      '/rest/v1/rpc/live_inbox': { pending: [], watching: 0 },
    }
    if (!(path in replies)) unexpected.push(path)
    await route.fulfill({ status: path in replies ? 200 : 500, contentType: 'application/json', body: JSON.stringify(replies[path] ?? { message: 'Unexpected mocked API request' }) })
  })
  const today = new TodayPage(page)
  await today.goto(MISTY, 'seed=a&ai=trivial')
  await expect(page.getByRole('button', { name: /Cuenta.*Jose_11/i })).toBeVisible()
  await today.chooseLead(0)
  await today.fightButton.click()
  const banner = page.getByRole('img', { name: 'Jose_11 contra Misty', exact: true })
  await expect(banner).toBeVisible()
  await expect(banner.getByText('Jose_11', { exact: true })).toBeVisible()
  expect(unexpected).toEqual([])
})
