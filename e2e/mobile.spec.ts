import { test, expect, type Page } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { startBattle } from './support'

/** RNF-03: 360x740 táctil. Solo corre en el proyecto mobile-360. */
const noHorizontalScroll = async (page: Page, where: string) => {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, inner: window.innerWidth }))
  expect(widths.inner, 'viewport 360').toBe(360)
  expect(widths.scroll, `scrollWidth <= 360 en ${where}`).toBeLessThanOrEqual(360)
}

const smallTargets = (page: Page) =>
  page.locator('button:visible').evaluateAll((buttons) =>
    (buttons as HTMLButtonElement[])
      .map((button) => ({ name: (button.textContent ?? '').trim().slice(0, 30), box: button.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ name, box }) => `${name}: ${Math.round(box.width)}x${Math.round(box.height)}`),
  )

test.describe('360 px táctil', () => {
  test('E2E-12 Hoy sin scroll horizontal y objetivos >= 44 px', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto()
    await noHorizontalScroll(page, 'Hoy')
    await today.rivalToggle.tap()
    await noHorizontalScroll(page, 'Hoy con paneles abiertos')
    expect(await smallTargets(page), 'botones menores de 44 px en Hoy').toEqual([])
  })

  test('E2E-67 la cabecera de Hoy cabe en una fila: logo (bola), #N, cuenta atrás e iconos, sin solaparse', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto()
    const boxes = await page.locator('.today-header-inner .logo-ball, .challenge-number, .countdown-value, .header-action').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { name: element.className, left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      }),
    )
    expect(boxes).toHaveLength(6)
    const middle = (box: { top: number; bottom: number }) => (box.top + box.bottom) / 2
    for (const box of boxes) expect(Math.abs(middle(box) - middle(boxes[0])), `${box.name} en la misma fila`).toBeLessThanOrEqual(4)
    for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].left, `${boxes[i].name} no pisa a ${boxes[i - 1].name}`).toBeGreaterThanOrEqual(boxes[i - 1].right)
    expect(boxes[boxes.length - 1].right).toBeLessThanOrEqual(360)
    // Los textos ocultos a la vista siguen para lectores de pantalla.
    await expect(page.getByRole('heading', { level: 1, name: 'Daily PWT' })).toBeAttached()
    await expect(page.locator('.today-header .countdown')).toContainText('Próximo reto en')
  })

  test('E2E-12 jugable con tap: combate completo, menús y diálogo', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a', tap: true })
    await battle.waitForActionOrResult()
    await noHorizontalScroll(page, 'Combate')
    expect(await smallTargets(page), 'botones menores de 44 px en combate').toEqual([])

    await battle.switchButton.tap()
    await expect(battle.switchOptions.first()).toBeVisible()
    await noHorizontalScroll(page, 'Cambio')
    expect(await smallTargets(page), 'botones menores de 44 px en Cambio').toEqual([])
    await battle.switchOptions.nth(1).tap()
    await expect(page.getByRole('group', { name: /Qué hacer con/ })).toBeVisible()
    expect(await smallTargets(page), 'botones menores de 44 px en el menú de Cambiar / Datos').toEqual([])
    await page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Datos' }).tap()
    await expect(page.locator('.bt-summary')).toBeVisible()
    await noHorizontalScroll(page, 'Datos')
    expect(await smallTargets(page), 'botones menores de 44 px en Datos (también las pestañas y flechas del fondo)').toEqual([])
    await page.getByRole('button', { name: 'Página siguiente' }).tap()
    await noHorizontalScroll(page, 'Datos, Habilidades')
    expect(await smallTargets(page), 'botones menores de 44 px en Habilidades').toEqual([])
    await page.getByRole('button', { name: 'Cerrar datos' }).tap()
    await page.getByRole('button', { name: 'Volver', exact: true }).tap()

    await battle.forfeitButton.tap()
    await expect(page.getByRole('dialog')).toBeVisible()
    await noHorizontalScroll(page, 'Diálogo')
    expect(await smallTargets(page), 'botones menores de 44 px en el diálogo').toEqual([])
    await page.getByRole('button', { name: 'Cancelar' }).tap()

    await battle.speedButton.tap()
    await battle.speedButton.tap()
    for (;;) {
      const state = await battle.waitForActionOrResult()
      if (state === 'result') break
      if (state === 'moves') {
        if ((await battle.enabledMoves.count()) === 0) await battle.fightButton.tap()
        await battle.enabledMoves.first().tap()
      } else {
        await battle.enabledSwitchOptions.first().tap()
        await page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Cambiar', exact: true }).tap()
      }
      await page.waitForTimeout(50)
    }
    await noHorizontalScroll(page, 'Resultado')
    expect(await smallTargets(page), 'botones menores de 44 px en Resultado').toEqual([])
    await page.getByRole('button', { name: 'Volver a Hoy' }).tap()
    await expect(new TodayPage(page).challengeNumber).toBeVisible()
  })
})
