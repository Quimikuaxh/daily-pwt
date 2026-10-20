import { test, expect } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { collectProblems, D0 } from './support'

test.describe('Pantalla Hoy', () => {
  test('E2E-01 Hoy completo con ?date=2026-10-17', async ({ page }) => {
    const problems = collectProblems(page)
    const today = new TodayPage(page)
    await today.goto(D0)

    await expect(today.challengeNumber, '#1 en el día de lanzamiento').toHaveText('#1')
    await expect(today.countdown, 'cuenta atrás hh:mm:ss').toHaveText(/^\d{2}:\d{2}:\d{2}$/)
    await expect(page.locator('.rival-name'), 'nombre del rival').not.toBeEmpty()
    await expect(today.rivalMons, '6 especies rivales').toHaveCount(6)
    await expect(today.playerCards, '6 tarjetas del jugador').toHaveCount(6)
    await expect(page.getByRole('heading', { level: 1 }).or(page.locator('.logo')), 'logo').toBeVisible()

    await expect(today.fightButton, 'Combatir desactivado sin inicial').toBeDisabled()
    const hint = page.getByText('Elige tu Pokémon inicial para poder combatir.')
    await expect(hint, 'motivo visible').toBeVisible()
    await expect(today.fightButton, 'motivo asociado al botón').toHaveAccessibleDescription(/Elige tu Pokémon inicial/)

    const footer = page.locator('footer')
    for (const owner of ['Nintendo', 'Creatures', 'GAME FREAK', 'The Pokémon Company']) {
      await expect(footer, `aviso fan menciona ${owner}`).toContainText(owner)
    }
    await expect(footer).toContainText('no oficial')

    // Sin iconos de Estadísticas/Ayuda/Ajustes ni botón de práctica (requisitos §1).
    await expect(page.getByRole('button', { name: /Estadísticas|Ayuda|Ajustes|Práctica/ })).toHaveCount(0)

    // Todas las imágenes cargan (sprites del repo).
    await page.waitForLoadState('networkidle')
    const broken = await page.locator('img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).filter((i) => !i.complete || i.naturalWidth === 0).length)
    expect(broken, 'imágenes rotas').toBe(0)
    expect(problems, 'consola limpia').toEqual([])
  })

  test('E2E-02 misma fecha en dos zonas horarias: mismo reto', async ({ browser, baseURL }) => {
    const snapshots: string[] = []
    for (const timezoneId of ['Pacific/Auckland', 'America/Los_Angeles']) {
      const context = await browser.newContext({ baseURL, timezoneId, locale: 'es-ES' })
      const page = await context.newPage()
      const today = new TodayPage(page)
      await today.goto('2026-10-19')
      const team = await page.locator('.player-name').allTextContents()
      snapshots.push(JSON.stringify({ number: await today.challengeNumber.textContent(), rival: await today.rivalName(), species: await today.rivalSpecies(), team }))
      await context.close()
    }
    expect(snapshots[1], 'mismo reto en ambas zonas').toBe(snapshots[0])
  })

  test('E2E-09 toggle de movimientos y objetos del rival: oculto por defecto', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    const rivalTeam = page.locator('ul.rival-team')

    await expect(today.rivalToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(rivalTeam.getByText(/^Objeto:/), 'sin objetos del rival ocultos').toHaveCount(0)
    await expect(rivalTeam.getByText(/^Habilidad:/)).toHaveCount(0)

    await today.rivalToggle.click()
    await expect(today.rivalToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(rivalTeam.getByText(/^Objeto:/), '6 objetos').toHaveCount(6)
    await expect(rivalTeam.getByText(/^Habilidad:/), '6 habilidades').toHaveCount(6)
    await expect(rivalTeam.locator('ul.move-list > li'), '6 x 4 movimientos').toHaveCount(24)
    await expect(rivalTeam.locator('.type-chip').first(), 'tipos en español, sin rótulo inglés').toHaveText(/^[A-Za-zÁÉÍÓÚáéíóúñ]+$/)

    await today.rivalToggle.click()
    await expect(rivalTeam.getByText(/^Objeto:/), 'vuelve a ocultarse').toHaveCount(0)
    await expect(rivalTeam.locator('ul.move-list')).toHaveCount(0)
  })
})

test.describe('Cambio de día (page.clock)', () => {
  test('E2E-03 23:59:55 + 10 s: #1 pasa a #2 sin recargar', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-17T23:59:55+02:00') })
    const today = new TodayPage(page)
    await page.goto('./')
    await today.challengeNumber.waitFor()
    await expect(today.challengeNumber).toHaveText('#1')
    await expect(today.countdown).toHaveText(/^00:00:0\d$/)
    const before = { rival: await today.rivalName(), team: await page.locator('.player-name').allTextContents() }
    await today.chooseLead(2)
    await expect(today.leadButtons.nth(2)).toHaveAttribute('aria-pressed', 'true')
    const marker = await page.evaluate(() => { (window as any).__noReload = true; return true })
    expect(marker).toBe(true)

    await page.clock.runFor(10_000)

    await expect(today.challengeNumber, 'reto nuevo').toHaveText('#2')
    expect(await page.evaluate(() => (window as any).__noReload), 'sin recarga').toBe(true)
    expect(await today.rivalName(), 'rival distinto').not.toBe(before.rival)
    expect(await page.locator('.player-name').allTextContents(), 'equipo distinto').not.toEqual(before.team)
    await expect(today.countdown, 'la cuenta atrás reinicia').toHaveText(/^23:59:\d\d$/)
    await expect(today.leadButtons.filter({ hasText: 'Sale primero' }), 'el inicial elegido no pasa al reto nuevo').toHaveCount(0)
  })

  const dstCases = [
    { name: 'cambio de hora de primavera (día de 23 h)', start: '2027-03-28T00:00:00+01:00', countdown: /^(23:00:00|22:59:\d\d)$/, crossing: '2027-03-28T23:59:55+02:00' },
    { name: 'cambio de hora de otoño (día de 25 h)', start: '2027-10-31T00:00:00+02:00', countdown: /^(25:00:00|24:59:\d\d)$/, crossing: '2027-10-31T23:59:55+01:00' },
  ]
  for (const dst of dstCases) {
    test(`E2E-03 ${dst.name}`, async ({ page }) => {
      const today = new TodayPage(page)
      await page.clock.install({ time: new Date(dst.start) })
      await page.goto('./')
      await today.challengeNumber.waitFor()
      await expect(today.countdown, 'la cuenta atrás cuenta las horas reales del día').toHaveText(dst.countdown)

      const page2 = await page.context().newPage()
      await page2.clock.install({ time: new Date(dst.crossing) })
      await page2.goto('./')
      const today2 = new TodayPage(page2)
      await today2.challengeNumber.waitFor()
      const first = Number((await today2.challengeNumber.textContent())!.slice(1))
      await page2.clock.runFor(10_000)
      await expect(today2.challengeNumber, 'un día exacto de diferencia').toHaveText(`#${first + 1}`)
    })
  }
})
