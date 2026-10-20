import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import { BattlePage } from './pages/BattlePage'
import { TodayPage } from './pages/TodayPage'
import { D0, startBattle, tabTo } from './support'

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`)
}

test.describe('Accesibilidad (axe, WCAG 2 A/AA, incluye contraste)', () => {
  test('E2E-11 Hoy, con paneles abiertos y con inicial elegido', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    expect(await seriousViolations(page), 'Hoy').toEqual([])
    await today.rivalToggle.click()
    await today.chooseLead(1)
    expect(await seriousViolations(page), 'Hoy con paneles y selección').toEqual([])
  })

  test('E2E-11 Combate, diálogo y Resultado', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    expect(await seriousViolations(page), 'Combate').toEqual([])

    await battle.switchButton.click()
    expect(await seriousViolations(page), 'Menú de cambio').toEqual([])
    await page.getByRole('button', { name: 'Volver' }).click()

    await battle.forfeitButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await seriousViolations(page), 'Diálogo de Rendirse').toEqual([])
    await page.getByRole('button', { name: 'Sí, rendirme' }).click()
    await expect(battle.resultTitle).toBeVisible()
    expect(await seriousViolations(page), 'Resultado (derrota)').toEqual([])
  })
})

test.describe('Teclado', () => {
  async function focusIsVisible(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
    })
  }

  test('E2E-10 partida completa solo con teclado, con foco visible', async ({ page }) => {
    const today = new TodayPage(page)
    const battle = new BattlePage(page)
    await today.goto(D0, 'seed=a&ai=trivial')

    await tabTo(page, today.leadButtons.nth(0))
    expect(await focusIsVisible(page), 'foco visible en "Sacar primero"').toBe(true)
    await page.keyboard.press('Enter')
    await expect(today.leadButtons.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await tabTo(page, today.fightButton)
    expect(await focusIsVisible(page), 'foco visible en Combatir').toBe(true)
    await page.keyboard.press('Enter')
    await battle.root.waitFor()

    await tabTo(page, battle.speedButton)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(battle.speedButton).toContainText('x4')

    let focusChecked = false
    for (;;) {
      const state = await battle.waitForActionOrResult()
      if (state === 'result') break
      if (state === 'moves' && (await battle.enabledMoves.count()) === 0) {
        await tabTo(page, battle.fightButton)
        await page.keyboard.press('Enter')
      }
      const target = state === 'moves' ? battle.enabledMoves.first() : battle.enabledSwitchOptions.first()
      await tabTo(page, target)
      if (!focusChecked) {
        expect(await focusIsVisible(page), 'foco visible en un movimiento').toBe(true)
        focusChecked = true
      }
      if (state === 'moves') await page.keyboard.press('Enter')
      else {
        // Pantalla de equipo: Enter abre el menú de la placa, que lleva el foco a Cambiar.
        await page.keyboard.press('Enter')
        await expect(page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cambiar', exact: true })).toBeFocused()
        await page.keyboard.press('Space')
      }
      await page.waitForTimeout(50)
    }
    await expect(battle.resultTitle).toBeVisible()
    await tabTo(page, page.getByRole('button', { name: 'Volver a Hoy' }))
    await page.keyboard.press('Enter')
    await expect(today.challengeNumber).toBeVisible()
  })

  test('E2E-10 los diálogos atrapan el foco, Escape cancela y el foco vuelve', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()

    await tabTo(page, battle.forfeitButton)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: '¿Quieres rendirte?' })
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), 'el foco no sale del diálogo').toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(battle.forfeitButton, 'el foco vuelve al botón que abrió el diálogo').toBeFocused()

    await tabTo(page, battle.exitButton)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: '¿Salir del combate?' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(battle.exitButton).toBeFocused()
  })
})
