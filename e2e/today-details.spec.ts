import { expect, test } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'

test('E2E-87 Hoy muestra las fichas al pasar el ratón o con el teclado y las cierra fuera o con Escape', async ({ page }) => {
  const today = new TodayPage(page)
  await today.goto()
  const card = today.playerCards.first()
  const move = card.locator('button.move-row').first()
  const item = card.locator('.mon-facts dd button').first()
  const ability = card.locator('.mon-facts dd button').last()
  const tooltip = page.getByRole('tooltip')

  await move.evaluate((button) => button.scrollIntoView({ block: 'center' }))
  await move.hover()
  await expect(tooltip.getByRole('heading')).toHaveText((await move.locator('.move-name').textContent())!)
  await expect(tooltip).toContainText('PP')
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)

  await item.click()
  await expect(tooltip).toContainText('Objeto')
  await expect(tooltip.locator('.bt-side-item-icon img')).toBeVisible()
  await page.locator('.player-name').nth(1).click()
  await expect(tooltip).toHaveCount(0)

  await item.focus()
  await page.keyboard.press('Tab')
  await expect(ability).toBeFocused()
  await expect(tooltip).toContainText('Habilidad')
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)

  const rival = page.locator('.rival-team')
  await expect(rival.getByRole('button')).toHaveCount(0)
  await today.rivalToggle.click()
  const rivalMove = rival.locator('button.move-row').first()
  await rivalMove.click()
  await expect(tooltip).toContainText('PP')
  await today.rivalToggle.click()
  await expect(tooltip).toHaveCount(0)
})

test('E2E-89 pulsar fuera durante la primera carga de la ficha cancela su apertura', async ({ page }) => {
  const chunk = '**/assets/DetailPopover-*.js'
  let allowDownload!: () => void
  const download = new Promise<void>((resolve) => { allowDownload = resolve })
  await page.route(chunk, async (route) => {
    await download
    await route.continue()
  })
  const today = new TodayPage(page)
  await today.goto()
  const item = today.playerCards.first().locator('.mon-facts dd button').first()
  const requested = page.waitForRequest(chunk)
  const downloaded = page.waitForResponse(chunk)
  await item.click()
  await requested
  try {
    await page.locator('.player-name').nth(1).click()
  } finally {
    allowDownload()
  }
  await downloaded
  await page.waitForLoadState('networkidle')
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveCount(0)
  await item.click()
  await expect(tooltip).toContainText('Objeto')
})
