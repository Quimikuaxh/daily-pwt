import { test, expect } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'
import { stageScale, startBattle } from './support'

// F3 · PRD §10.5, §10.6 y decisiones del 22/10/2026: Ayuda, Ajustes (velocidad guardada, borrar datos) y marco de consola en escritorio.
test.describe('Ayuda y Ajustes', () => {
  test('E2E-61 Ayuda se abre desde Hoy con créditos y aviso legal, y se cierra con Escape @smoke', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto()
    await page.getByRole('button', { name: 'Ayuda' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ayuda' })
    await expect(dialog.getByRole('heading', { name: 'Cómo se juega' })).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Créditos' })).toBeAttached()
    await expect(dialog).toContainText('no oficial')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('E2E-62 la velocidad elegida en Ajustes se guarda al recargar y la usa el combate', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(undefined, 'seed=a&ai=trivial')
    await page.getByRole('button', { name: 'Ajustes' }).click()
    await page.getByRole('button', { name: 'x4' }).click()
    await page.reload()
    await today.challengeNumber.waitFor()
    await page.getByRole('button', { name: 'Ajustes' }).click()
    await expect(page.getByRole('button', { name: 'x4' })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await today.chooseLead(0)
    await today.practiceButton.click()
    const battle = new BattlePage(page)
    await battle.root.waitFor()
    await expect(page.getByRole('button', { name: /^Velocidad/ })).toContainText('x4')
  })

  test('E2E-63 borrar datos locales tras el oficial lo deja otra vez por jugar', async ({ page }) => {
    const { battle, today } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await battle.forfeitButton.click()
    await page.getByRole('button', { name: 'Sí, rendirme' }).click()
    await page.getByRole('button', { name: 'Volver a Hoy' }).click()
    await expect(today.fightButton).toBeDisabled()
    await page.getByRole('button', { name: 'Ajustes' }).click()
    await page.getByRole('button', { name: 'Borrar datos locales' }).click()
    await page.getByRole('button', { name: 'Sí, borrar' }).click()
    await expect(page.getByText('Datos borrados.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(today.officialStatus).toHaveText('Jugar')
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('daily-pwt')))).toEqual([])
  })
})

test.describe('Marco de consola en escritorio', () => {
  test('E2E-64 a 1440x900 el combate va enmarcado (DS sencilla) sin perder la escala 2; a 1280x720 sin marco', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await startBattle(page, { seed: 'a', mode: 'practice' })
    await expect(page.locator('.bt-console[data-frame]')).toBeVisible()
    expect(await stageScale(page)).toBe(2)
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('.bt-console[data-frame]')).toHaveCount(0)
  })
})
