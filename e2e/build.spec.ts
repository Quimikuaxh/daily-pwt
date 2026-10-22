import { test, expect, type Response } from '@playwright/test'
import { gzipSync } from 'node:zlib'
import { TodayPage } from './pages/TodayPage'
import { DEFAULT_SCENARIO, LAUNCH_DATE, addDays, scenarioQuery } from './support'

// Era 200 KB con 6 entrenadores; 230 KB con el roster de 53 (ARQUITECTURA DEC-40). El requisito real es el tiempo (< 3 s en 4G).
const CRITICAL_PATH_BUDGET_KB = 230
const PORT_PROD = Number(process.env.E2E_PORT_PROD ?? 4392)
const PROD = `http://127.0.0.1:${PORT_PROD}`

test.describe('Build de producción (sin VITE_TEST_HOOKS)', () => {
  test('E2E-17 los ganchos se ignoran y no están en el bundle', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: PROD, timezoneId: 'Europe/Madrid', locale: 'es-ES' })
    const page = await context.newPage()
    await page.clock.install({ time: new Date(`${addDays(LAUNCH_DATE, 6)}T12:00:00+01:00`) })
    const scriptUrls = new Set<string>()
    page.on('response', (response) => {
      if (/\.js$/.test(new URL(response.url()).pathname)) scriptUrls.add(response.url())
    })
    const today = new TodayPage(page)
    await page.goto(`./?date=${LAUNCH_DATE}&trainer=brock&seed=zzz&ai=trivial`)
    await today.challengeNumber.waitFor()
    await today.chooseLead(0)
    await today.fightButton.click()
    await page.getByTestId('battle-screen').waitFor()
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await page.getByRole('button', { name: 'Sí, salir' }).click()
    await today.challengeNumber.waitFor()

    // LAUNCH_DATE + 6 días es el día #7: ?date= y ?trainer= no mandan en producción.
    await expect(today.challengeNumber, '?date= ignorado').toHaveText('#7')
    const scripts = await Promise.all([...scriptUrls].map(async (url) => (await context.request.get(url)).text()))
    expect(scripts.length, 'se han leído los scripts del sitio').toBeGreaterThan(0)
    for (const script of scripts) {
      expect(script, 'sin lectura de la query string').not.toContain('URLSearchParams')
      expect(script).not.toContain('VITE_TEST_HOOKS')
    }
    await context.close()
  })

  test('E2E-17 el mismo enlace con ganchos sí fija la fecha y el rival en el build de pruebas', async ({ page }) => {
    await page.clock.install({ time: new Date(`${addDays(LAUNCH_DATE, 6)}T12:00:00+01:00`) })
    const today = new TodayPage(page)
    await page.goto(`./?date=${LAUNCH_DATE}&trainer=brock&variant=brock-world-leaders`)
    await expect(today.challengeNumber).toHaveText('#1')
    await expect(page.locator('.rival-name')).toContainText('Brock')
  })
})

test.describe('Rendimiento con red y CPU limitadas', () => {
  test('E2E-21 4G + CPU x4: Hoy < 3 s, ruta crítica < 230 KB gzip, sim y calc fuera @timing', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'El throttling CDP solo existe en Chromium')
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    // Marca el instante (epoch ms) en que Hoy pinta el número de reto: lo anterior es la ruta crítica.
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        if (document.querySelector('.challenge-number')) {
          ;(window as unknown as { __firstRender: number }).__firstRender = performance.timeOrigin + performance.now()
          observer.disconnect()
        }
      })
      observer.observe(document, { childList: true, subtree: true })
    })
    const responses: Response[] = []
    const requestedUrls: string[] = []
    page.on('request', (request) => requestedUrls.push(request.url()))
    page.on('response', (response) => responses.push(response))

    const today = new TodayPage(page)
    const started = Date.now()
    await page.goto(`./?${scenarioQuery(DEFAULT_SCENARIO)}`)
    await today.challengeNumber.waitFor()
    await expect(today.fightButton).toBeVisible()
    const elapsed = Date.now() - started
    await page.waitForTimeout(1500)
    const firstRender = await page.evaluate(() => (window as unknown as { __firstRender: number }).__firstRender)

    const critical: Response[] = []
    for (const response of responses) {
      // timing() solo es fiable una vez terminada la petición.
      if (response.request().timing().startTime < firstRender) critical.push(response)
    }
    const paths = critical.map((response) => new URL(response.url()).pathname)
    expect(elapsed, `Hoy listo en ${elapsed} ms`).toBeLessThan(3000)
    const heavy = critical.filter((response) => ['document', 'script', 'stylesheet', 'font'].includes(response.request().resourceType()))
    const sizes = await Promise.all(heavy.map(async (response) => gzipSync(await response.body(), { level: 9 }).length))
    const totalKb = sizes.reduce((sum, size) => sum + size, 0) / 1024
    expect(totalKb, `ruta crítica ${totalKb.toFixed(1)} KB gzip (${paths.join(', ')})`).toBeLessThan(CRITICAL_PATH_BUDGET_KB)
    expect(paths.filter((path) => /battle\.worker|\/damage-/.test(path)), 'sim y @smogon/calc fuera de la ruta crítica').toEqual([])
    // El sim sí se descarga después, en idle, para que "Combatir" no espere.
    expect(requestedUrls.some((url) => /battle\.worker/.test(url)), 'el worker se precarga tras pintar').toBe(true)
  })
})
