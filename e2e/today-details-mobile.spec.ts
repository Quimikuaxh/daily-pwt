import { expect, test } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'

test('E2E-88 Hoy abre la ficha con un toque y la cierra al tocar fuera, sin tapar la barra de combate', async ({ page }) => {
  const today = new TodayPage(page)
  await today.goto()
  const card = today.playerCards.first()
  const ability = card.locator('.mon-facts dd button').last()
  await ability.evaluate((button) => button.scrollIntoView({ block: 'center' }))
  await ability.tap()

  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toContainText('Habilidad')
  const [pop, footer] = await Promise.all([tooltip.boundingBox(), page.locator('.fight-bar').boundingBox()])
  expect(pop!.x).toBeGreaterThanOrEqual(0)
  expect(pop!.x + pop!.width).toBeLessThanOrEqual(360)
  expect(pop!.y + pop!.height).toBeLessThan(footer!.y)
  await card.getByRole('heading').tap()
  await expect(tooltip).toHaveCount(0)

  await ability.tap()
  await expect(tooltip).toBeVisible()
  await ability.tap()
  await expect(tooltip).toHaveCount(0)
})
