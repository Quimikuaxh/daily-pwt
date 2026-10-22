import { test, expect } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { BattlePage } from './pages/BattlePage'
import { DEFAULT_SCENARIO, LAUNCH_DATE, collectProblems } from './support'

test.describe('Pantalla Hoy', () => {
  test('E2E-01 Hoy completo en el día de lanzamiento', async ({ page }) => {
    const problems = collectProblems(page)
    const today = new TodayPage(page)
    await today.goto({ ...DEFAULT_SCENARIO, date: LAUNCH_DATE })

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

    // F3: accesos a Estadísticas, Ayuda y Ajustes en la cabecera. Los botones de combate son el oficial y la práctica.
    for (const name of ['Estadísticas', 'Ayuda', 'Ajustes']) await expect(page.getByRole('banner').getByRole('button', { name })).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^(Combate oficial|Práctica)/ }), 'botones de combate: oficial y práctica').toHaveCount(2)

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
      await today.goto()
      const team = await page.locator('.player-name').allTextContents()
      snapshots.push(JSON.stringify({ number: await today.challengeNumber.textContent(), rival: await today.rivalName(), species: await today.rivalSpecies(), team }))
      await context.close()
    }
    expect(snapshots[1], 'mismo reto en ambas zonas').toBe(snapshots[0])
  })

  test('E2E-09 toggle de movimientos y objetos del rival: oculto por defecto', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto()
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
  test('E2E-03 23:59:55 + 10 s: #1 pasa a #2 sin recargar @timing', async ({ page }) => {
    await page.clock.install({ time: new Date(`${LAUNCH_DATE}T23:59:55+02:00`) })
    const today = new TodayPage(page)
    await page.goto('./')
    await today.challengeNumber.waitFor()
    await expect(today.challengeNumber).toHaveText('#1')
    await expect(today.countdown).toHaveText(/^00:00:0\d$/)
    const before = { rival: await today.rivalName(), team: await page.locator('.player-name').allTextContents() }
    // Con el reloj simulado, WebKit bajo carga a veces descarta el primer clic: se reintenta hasta que quede marcado.
    await expect(async () => {
      if ((await today.leadButtons.nth(2).getAttribute('aria-pressed')) !== 'true') await today.chooseLead(2)
      await expect(today.leadButtons.nth(2)).toHaveAttribute('aria-pressed', 'true', { timeout: 2000 })
    }).toPass({ timeout: 15_000 })
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
    { name: 'cambio de hora de primavera (día de 23 h)', start: '2027-03-28T00:00:00+01:00', countdown: /^(23:00:00|22:59:\d\d)$/, crossing: '2027-03-28T23:59:30+02:00' },
    { name: 'cambio de hora de otoño (día de 25 h)', start: '2027-10-31T00:00:00+02:00', countdown: /^(25:00:00|24:59:\d\d)$/, crossing: '2027-10-31T23:59:30+01:00' },
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
      // Margen de 30 s: con dos páginas abiertas (y la precarga de la primera) WebKit tarda varios segundos en cargar la segunda.
      await page2.clock.runFor(40_000)
      await expect(today2.challengeNumber, 'un día exacto de diferencia').toHaveText(`#${first + 1}`)
    })
  }
})

test.describe('Precarga de la caja de datos', () => {
  test('E2E-44 Hoy precarga los dígitos de PS y las barras antes del combate (sin parpadeo de dígitos viejos)', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto()
    const wanted = [...Array(10).keys()].map((digit) => `digits/hp-${digit}.png`).concat(['hp/fill-green.png', 'hp/fill-yellow.png', 'hp/fill-red.png'])
    await expect
      .poll(() => page.evaluate((names) => {
        const loaded = performance.getEntriesByType('resource').map((entry) => entry.name)
        return names.filter((name) => !loaded.some((url) => url.endsWith(name)))
      }, wanted))
      .toEqual([])
  })
})

test.describe('Ver/ocultar los sets del rival', () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
    test(`E2E-45 al ocultar, el panel del rival vuelve a la vista (${viewport.width} px)`, async ({ page }) => {
      await page.setViewportSize(viewport)
      const today = new TodayPage(page)
      await today.goto()
      const panel = page.getByRole('region', { name: /rival/i })
      await expect(today.rivalToggle).toHaveText('Ver movimientos y objetos del rival')

      await today.rivalToggle.click()
      await expect(today.rivalToggle).toHaveText('Ocultar movimientos y objetos del rival')
      await expect(today.rivalToggle).toHaveAttribute('aria-expanded', 'true')

      // El botón queda al final de los sets: se puede ocultar sin volver arriba.
      await today.rivalToggle.scrollIntoViewIfNeeded()
      await expect(today.rivalToggle).toBeInViewport()
      const scrolledDown = await page.evaluate(() => window.scrollY)
      await today.rivalToggle.click()

      await expect(today.rivalToggle).toHaveText('Ver movimientos y objetos del rival')
      await expect(today.rivalToggle).toHaveAttribute('aria-expanded', 'false')
      await expect.poll(async () => (await panel.boundingBox())!.y, { message: 'el panel del rival queda a la vista bajo la cabecera' }).toBeGreaterThanOrEqual(0)
      await expect.poll(async () => (await panel.boundingBox())!.y).toBeLessThan(120)
      await expect(panel.getByRole('heading', { level: 2 })).toBeInViewport()
      expect(scrolledDown, 'antes de ocultar se estaba más abajo').toBeGreaterThan(await page.evaluate(() => window.scrollY))
    })
  }

  test('E2E-45 con prefers-reduced-motion sube sin animación', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 360, height: 740 })
    const today = new TodayPage(page)
    await today.goto()
    await today.rivalToggle.click()
    await today.rivalToggle.scrollIntoViewIfNeeded()
    await today.rivalToggle.click()
    const panel = page.getByRole('region', { name: /rival/i })
    // Sin animación la posición final se alcanza en el mismo fotograma: una sola lectura inmediata basta.
    const top = await panel.evaluate((element) => element.getBoundingClientRect().top)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top).toBeLessThan(120)
  })
})

test.describe('Precarga de la interfaz y de los sprites del reto', () => {
  test('E2E-48 Hoy solo pide sprites del reto de hoy (12 Pokémon, frente y espalda, y el entrenador), no los del resto del pool @timing', async ({ page }) => {
    const spriteRequests = new Set<string>()
    page.on('request', (request) => {
      const match = /\/sprites\/(pokemon\/(?:front|back)|trainers)\/([a-z0-9-]+)\.gif$/.exec(new URL(request.url()).pathname)
      if (match) spriteRequests.add(`${match[1]}/${match[2]}`)
    })
    const today = new TodayPage(page)
    await today.goto()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    const pokemon = [...spriteRequests].filter((request) => request.startsWith('pokemon/'))
    const speciesIds = new Set(pokemon.map((request) => request.split('/')[2]))
    expect(speciesIds.size, 'especies pedidas: 6 rivales + 6 propios como máximo').toBeLessThanOrEqual(12)
    expect(speciesIds.size).toBeGreaterThanOrEqual(8)
    for (const id of speciesIds) {
      expect(pokemon, `${id}: frente y espalda`).toEqual(expect.arrayContaining([`pokemon/front/${id}`, `pokemon/back/${id}`]))
    }
    expect([...spriteRequests].filter((request) => request.startsWith('trainers/')), 'solo el entrenador rival').toHaveLength(1)
  })

  test('E2E-49 con la red lenta, Equipo y Datos no se enseñan a medio cargar (todas las imágenes visibles ya cargadas en el primer fotograma) @timing', async ({ page }) => {
    await page.route(/\/ui\/battle\/.*\.png$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350))
      await route.continue()
    })
    const today = new TodayPage(page)
    await today.goto(undefined, 'seed=a&ai=trivial')
    await page.waitForLoadState('networkidle')
    await today.chooseLead(0)
    await today.fightButton.click()
    const battle = new BattlePage(page)
    await battle.root.waitFor()
    await battle.maxSpeed()
    await battle.waitForActionOrResult()

    const unloadedImages = (selector: string) =>
      page.evaluate((root) => [...document.querySelectorAll(`${root} img`)].filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0).map((image) => image.getAttribute('src')), selector)

    await page.getByRole('button', { name: 'Cambiar', exact: true }).click()
    await page.locator('.bt-party').waitFor()
    expect(await unloadedImages('.bt-party'), 'equipo: sin imágenes pendientes en el primer fotograma').toEqual([])

    await page.locator('.bt-party-panel').nth(1).click()
    await page.getByRole('group', { name: /Qué hacer con/ }).getByRole('button', { name: 'Datos' }).click()
    await page.locator('.bt-summary').waitFor()
    expect(await unloadedImages('.bt-summary'), 'datos: sin imágenes pendientes en el primer fotograma').toEqual([])
    await page.keyboard.press('ArrowRight')
    expect(await unloadedImages('.bt-summary'), 'datos, página 2').toEqual([])
  })
})
