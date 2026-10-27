import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { MISTY, openParty, openSummary, stageScale, startBattle } from './support'

// RF-70 / RF-71: menú de equipo y pantalla de datos del Pokémon (en combate).
const optionsGroup = (page: import('@playwright/test').Page) => page.getByRole('group', { name: /Qué hacer con/ })

test.describe('Menú de equipo y datos', () => {
  test('E2E-25 abrir el equipo desde el combate: 6 placas con nombre, nivel, PS y estado; Volver regresa', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await openParty(page)
    const panels = page.locator('.bt-party-panel')
    await expect(panels).toHaveCount(6)
    await expect(page.locator('.bt-party-level').first()).toHaveText('Nv.50')
    await expect(panels.first(), 'el activo se anuncia en combate').toHaveAccessibleName(/en combate/i)
    await expect(page.locator('.bt-member-icon')).toHaveCount(6)
    await expect(page.getByText('Elige un Pokémon.')).toBeVisible()
    await page.getByRole('button', { name: 'Volver', exact: true }).click()
    await expect(page.locator('.bt-party-panel')).toHaveCount(0)
    await expect(battle.fightButton).toBeEnabled()
  })

  test('E2E-25 elegir Pokémon: Cambiar / Datos / Cancelar, y cambiar desde el menú envía el cambio', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    const leadName = await page.getByTestId('player-hp').locator('.bt-databox-name').textContent()
    await openParty(page)
    await page.locator('.bt-party-panel[data-state="ready"]').first().click()
    const group = optionsGroup(page)
    await expect(group.getByRole('button')).toHaveText(['Cambiar', 'Datos', 'Cancelar'])
    await group.getByRole('button', { name: 'Cancelar' }).click()
    await expect(group).toHaveCount(0)
    await battle.chooseSubstitute()
    await expect(page.getByTestId('player-hp').locator('.bt-databox-name'), 'entra otro Pokémon').not.toHaveText(leadName ?? '', { timeout: 30_000 })
  })

  test('E2E-26 Datos: tres páginas con navegación por botones y teclado, Volver y Cerrar', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await openParty(page)
    await openSummary(page, 1)
    const summary = page.locator('.bt-summary')
    await expect(summary).toHaveAttribute('data-page', '0')
    await expect(summary.locator('.bt-sum-page-title')).toHaveText('Información')

    await summary.getByRole('button', { name: 'Página siguiente' }).click()
    await expect(summary).toHaveAttribute('data-page', '1')
    await expect(summary.locator('.bt-sum-page-title')).toHaveText('Habilidades')
    await expect(summary.locator('.bt-sum-slot')).toHaveCount(4)

    await page.keyboard.press('ArrowRight')
    await expect(summary).toHaveAttribute('data-page', '2')
    await expect(summary.locator('.bt-sum-move-text')).not.toBeEmpty()
    await page.keyboard.press('ArrowLeft')
    await expect(summary).toHaveAttribute('data-page', '1')

    const nameBefore = await summary.getAttribute('aria-label')
    await page.keyboard.press('ArrowDown')
    await expect(summary).not.toHaveAttribute('aria-label', nameBefore ?? '')

    await summary.getByRole('button', { name: /Ver detalle de/ }).nth(2).click()
    await expect(summary).toHaveAttribute('data-page', '2')
    await expect(summary.getByRole('button', { name: /Ver detalle de/ }).nth(2)).toHaveAttribute('aria-pressed', 'true')
    await summary.getByRole('button', { name: 'Volver', exact: true }).click()
    await expect(summary).toHaveAttribute('data-page', '1')
    await page.keyboard.press('Escape')
    await expect(page.locator('.bt-summary')).toHaveCount(0)
    await expect(page.locator('.bt-party-panel')).toHaveCount(6)
  })

  test('E2E-26 los PS actuales y los PP de Datos reflejan el combate', async ({ page }) => {
    // Misty con la semilla b: tras el primer movimiento no hay cambio forzado (contra Plubio, el escenario por defecto, sí, y la pantalla de
    // equipo ya estaría abierta). La semilla a dejó de servir con el mínimo de 3060 (23/10/2026): ahora hay un KO en el turno 1.
    const { battle } = await startBattle(page, { scenario: MISTY, seed: 'b' })
    await battle.maxSpeed()
    await battle.waitForActionOrResult()
    await battle.chooseFirstMove()
    await battle.waitForActionOrResult()
    await openParty(page)
    const lead = page.locator('.bt-party-panel').first()
    const hpText = (await lead.locator('.bt-party-hp').textContent()) ?? ''
    await openSummary(page, 0)
    const summary = page.locator('.bt-summary')
    await summary.getByRole('button', { name: 'Página siguiente' }).click()
    const [current, max] = hpText.split('/')
    await expect(summary.locator('.bt-sum-value').filter({ hasText: `${current} / ${max}` })).toBeVisible()
    const ppValues = await summary.locator('.bt-sum-slot-pp-value').allTextContents()
    expect(ppValues.some((value) => { const [now, full] = value.split('/').map(Number); return now < full }), 'el movimiento usado ha gastado un PP').toBe(true)
  })

  test('E2E-27 cambio forzado: sin cancelar, con Datos disponible', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.maxSpeed()
    for (let guard = 0; guard < 60; guard += 1) {
      const state = await battle.waitForActionOrResult()
      expect(state).not.toBe('result')
      if (state === 'switch') break
      await battle.chooseFirstMove()
      await page.waitForTimeout(50)
    }
    await expect(page.getByText('Elige el siguiente Pokémon.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Volver|Cancelar)$/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.locator('.bt-party-panel')).toHaveCount(6)
    await page.locator('.bt-party-panel[data-state="ready"]').first().click()
    await optionsGroup(page).getByRole('button', { name: 'Datos' }).click()
    await expect(page.locator('.bt-summary')).toBeVisible()
    await page.keyboard.press('Escape')
    await battle.chooseSubstitute()
    expect(await battle.waitForActionOrResult()).toBe('moves')
  })

  test('E2E-28 accesibilidad (axe) del equipo, del menú y de las tres páginas de datos', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await openParty(page)
    const violations = async (where: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical').map((violation) => `${where}: ${violation.id}`)).toEqual([])
    }
    await violations('equipo')
    await page.locator('.bt-party-panel').nth(1).click()
    await violations('menú')
    await optionsGroup(page).getByRole('button', { name: 'Datos' }).click()
    await page.locator('.bt-summary').waitFor()
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
      await violations(`datos ${pageIndex + 1}`)
      await page.keyboard.press('ArrowRight')
    }
  })

  test('E2E-29 teclado: Tab llega a las placas, Enter abre el menú y Escape lo cierra devolviendo el foco', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await openParty(page)
    const panel = page.locator('.bt-party-panel').nth(2)
    await panel.focus()
    await page.keyboard.press('Enter')
    await expect(optionsGroup(page).getByRole('button', { name: 'Cambiar' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(optionsGroup(page).getByRole('button', { name: 'Datos' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(optionsGroup(page)).toHaveCount(0)
    await expect(panel).toBeFocused()
  })

  test('el lienzo del combate usa escala entera desde x2 y las pantallas de equipo y datos escalan con él', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    const scale = await stageScale(page)
    expect(scale).toBeGreaterThanOrEqual(1)
    if (scale >= 2) expect(Math.abs(scale - Math.round(scale))).toBeLessThan(0.01)
    await openParty(page)
    expect(await stageScale(page)).toBeCloseTo(scale, 3)
    const party = await page.locator('.bt-party').boundingBox()
    const stage = await page.locator('.bt-ds').boundingBox()
    expect(party?.width).toBeCloseTo(stage?.width ?? 0, 1)
    expect(party?.height).toBeCloseTo(stage?.height ?? 0, 1)
  })
})

test.describe('Cambio animado', () => {
  test('E2E-35 el cambio voluntario muestra al entrenador, la bola y el rayo y no bloquea el turno', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await openParty(page)
    await battle.chooseSubstitute()
    const field = page.getByTestId('field')
    await expect(field).toHaveAttribute('data-switch', 'player')
    await expect(page.locator('.bt-intro')).toBeVisible()
    const path = await page.locator('.bt-intro').evaluate((element) => {
      const style = getComputedStyle(element)
      return { fromX: style.getPropertyValue('--player-from-x'), landY: style.getPropertyValue('--player-land-y'), beam: style.getPropertyValue('--player-beam-length') }
    })
    expect(path.fromX).toMatch(/px$/)
    expect(Number.parseFloat(path.landY)).toBeLessThan(147)
    expect(Number.parseFloat(path.beam)).toBeGreaterThan(10)
    await expect(field).not.toHaveAttribute('data-switch', /./, { timeout: 15_000 })
    await expect(page.locator('.bt-intro')).toHaveCount(0)
    expect(await battle.waitForActionOrResult()).toBe('moves')
  })
})

test.describe('Cambio animado con movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' })

  test('E2E-35 con prefers-reduced-motion y Animaciones «Según el sistema» no se dibujan ni entrenador ni bola', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('daily-pwt:settings', JSON.stringify({ version: 1, speed: 1, animations: 'system' })))
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await openParty(page)
    await battle.chooseSubstitute()
    await expect(page.getByTestId('field')).toHaveAttribute('data-switch', 'player')
    expect(await page.locator('.bt-intro').evaluate((element) => getComputedStyle(element).display)).toBe('none')
  })

  // Animaciones (24/10/2026, Jose): por defecto «Siempre», aunque el sistema pida reducir movimiento.
  test('E2E-71 con prefers-reduced-motion y Animaciones «Siempre» (por defecto) el combate sí se anima', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await expect(page.getByTestId('battle-screen')).not.toHaveAttribute('data-reduced-motion', 'true')
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('full')
    const duration = await page.locator('.bt-sprite').first().evaluate((element) => getComputedStyle(element).animationDuration)
    expect(duration, 'la regla global de reducir movimiento no se aplica').not.toBe('0.00001s')
  })
})

test.describe('Equipo: texto centrado en la placa', () => {
  test('E2E-43 las mayúsculas del nombre, el nivel y los PS quedan centradas en su franja de la placa (≤ 1 px nativo)', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    await openParty(page)
    const measured = await page.locator('.bt-party-panel').first().evaluate(async (panelElement) => {
      await document.fonts.ready
      const canvas = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
      const results: { text: string; band: string; capCenter: number; capTop: number; baseline: number }[] = []
      for (const panel of Array.from(document.querySelectorAll<HTMLElement>('.bt-party-panel'))) {
        const rect = panel.getBoundingClientRect()
        const scale = rect.height / 46
        for (const element of Array.from(panel.querySelectorAll<HTMLElement>('[data-band]'))) {
          const style = getComputedStyle(element)
          canvas.font = `${style.fontSize} ${style.fontFamily}`
          const capHeight = canvas.measureText('H').actualBoundingBoxAscent
          const probe = document.createElement('span')
          probe.style.cssText = 'display:inline-block;width:0;height:0'
          element.appendChild(probe)
          const baseline = (probe.getBoundingClientRect().bottom - rect.top) / scale
          probe.remove()
          results.push({ text: (element.textContent ?? '').trim(), band: element.dataset.band as string, capTop: baseline - capHeight, capCenter: baseline - capHeight / 2, baseline })
        }
      }
      void panelElement
      return results
    })
    expect(measured.length).toBeGreaterThanOrEqual(18)
    for (const item of measured) {
      const [top, bottom] = item.band.split(',').map(Number)
      expect(Math.abs(item.capCenter - (top + bottom) / 2), `"${item.text}": mayúsculas ${item.capTop.toFixed(1)}..${item.baseline.toFixed(1)} en ${item.band}`).toBeLessThanOrEqual(1.01)
    }
  })
})

// RIVAL en el cambio forzado (27/10/2026, decisión de Jose): desde la pantalla de equipo se consulta al rival y se vuelve a elegir.
test.describe('Cambio forzado', () => {
  test('E2E-73 tras un KO, RIVAL abre el equipo del rival y Volver regresa a elegir sustituto', async ({ page }) => {
    test.setTimeout(240_000)
    const { battle } = await startBattle(page, { seed: 'a', mode: 'practice' })
    await battle.maxSpeed()
    let state = await battle.waitForActionOrResult()
    for (let turn = 0; state === 'moves' && turn < 60; turn += 1) {
      await battle.chooseFirstMove()
      state = await battle.waitForActionOrResult()
    }
    test.skip(state !== 'switch', 'la partida acabó sin un cambio forzado del jugador')
    await page.getByRole('region', { name: 'Equipo' }).getByRole('button', { name: 'Ver el equipo rival' }).click()
    const rival = page.getByRole('region', { name: 'Equipo rival' })
    await expect(rival.locator('.bt-party-panel')).toHaveCount(6)
    await rival.getByRole('button', { name: 'Volver' }).click()
    await expect(rival).toHaveCount(0)
    await battle.chooseSubstitute()
    await expect(page.locator('.bt-party')).toHaveCount(0)
  })
})
