import { test, expect } from '@playwright/test'
import { TodayPage } from './pages/TodayPage'
import { D0, collectProblems, startBattle } from './support'

const GIF_FRONT = '**/sprites/pokemon/front/*.gif'

test.describe('Fallos controlados', () => {
  test('E2E-13 datos corruptos: error en español en Hoy, sin pantalla en blanco', async ({ page }) => {
    let corrupted = false
    await page.route('**/assets/index-*.js', async (route) => {
      const response = await route.fetch()
      const body = await response.text()
      const broken = body.replace('dataVersion:`f1-1`', 'dataVersion:``')
      corrupted = broken !== body
      await route.fulfill({ response, body: broken })
    })
    await page.goto(`./?date=${D0}`)
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    expect(corrupted, 'el test ha corrompido realmente los datos del bundle').toBe(true)
    await expect(alert).toContainText('No se han podido preparar los datos del reto de hoy')
    const text = (await page.locator('body').innerText()).trim()
    expect(text, 'sin trazas ni ids técnicos').not.toMatch(/DataError|undefined|\bat \w+|dataVersion|f1-1/)
    await expect(page.getByRole('button', { name: 'Combatir' }), 'sin botón de combate').toHaveCount(0)
    await expect(page.locator('footer'), 'la página sigue montada').toBeVisible()
  })

  test('E2E-14 fallo del worker: error en español con Volver a Hoy', async ({ page }) => {
    await page.route('**/assets/battle.worker-*.js', (route) => route.abort())
    const today = new TodayPage(page)
    await today.goto(D0, 'seed=a&ai=trivial')
    await today.chooseLead(0)
    await today.fightButton.click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Se ha producido un problema en el combate')
    await expect(page.locator('body')).not.toContainText(/Error:|undefined/)
    await page.getByRole('button', { name: 'Volver a Hoy' }).click()
    await expect(today.challengeNumber, 'vuelve a Hoy').toBeVisible()
    await expect(today.fightButton).toBeDisabled()
  })

  test('E2E-15 GIF abortado: caja con el nombre y mismas dimensiones', async ({ page }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    await page.waitForLoadState('networkidle')
    const normal = await page.locator('ul.rival-team img.sprite').first().boundingBox()
    expect(normal).not.toBeNull()
    const names = await today.rivalSpecies()

    await page.route(GIF_FRONT, (route) => route.abort())
    await page.reload()
    await today.challengeNumber.waitFor()
    const fallbacks = page.locator('ul.rival-team .sprite-fallback')
    await expect(fallbacks, 'una caja por Pokémon rival').toHaveCount(6)
    await expect(page.locator('ul.rival-team img.sprite')).toHaveCount(0)
    expect(await fallbacks.allTextContents(), 'la caja lleva el nombre').toEqual(names)
    const box = await fallbacks.first().boundingBox()
    expect(box!.width, 'ancho igual').toBe(normal!.width)
    expect(box!.height, 'alto igual').toBe(normal!.height)
    await expect(page.locator('.player-card .sprite-fallback'), 'también en las tarjetas del jugador').toHaveCount(6)
  })
})

test.describe('Sprites pixelados', () => {
  test('E2E-16 image-rendering pixelated, escala entera y GIF animado', async ({ page, request }) => {
    const today = new TodayPage(page)
    await today.goto(D0)
    await page.waitForLoadState('networkidle')

    const sprites = await page.locator('img.sprite').evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).map((img) => {
        const style = getComputedStyle(img)
        return { rendering: style.imageRendering, fit: style.objectFit, natural: img.naturalWidth, src: img.src }
      }),
    )
    expect(sprites.length).toBeGreaterThanOrEqual(13)
    for (const sprite of sprites) {
      expect(sprite.rendering, `pixelado: ${sprite.src}`).toMatch(/pixelated|crisp-edges/)
      expect(sprite.fit, 'tamaño natural (x1) en Hoy').toBe('none')
      expect(sprite.natural).toBeGreaterThan(0)
    }

    // GIF animado: más de un fotograma (bloques Graphic Control Extension 21 F9 04).
    const url = sprites.find((s) => s.src.includes('/pokemon/front/'))!.src
    const body = await (await request.get(url)).body()
    let frames = 0
    for (let i = 0; i < body.length - 2; i += 1) if (body[i] === 0x21 && body[i + 1] === 0xf9 && body[i + 2] === 0x04) frames += 1
    expect(frames, 'GIF animado').toBeGreaterThan(1)

  })

  test('E2E-16 en combate los sprites se escalan a múltiplos enteros del lienzo (que es entero desde x2)', async ({ page }) => {
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    const field = await page.getByTestId('field').boundingBox()
    const canvasScale = field!.width / 256
    // Por debajo de x2 el lienzo puede ser fraccionario (RNF-06); desde x2 es entero.
    if (canvasScale >= 2) expect(Math.abs(canvasScale - Math.round(canvasScale)), `lienzo entero (${canvasScale})`).toBeLessThan(0.01)
    const scales = await page.locator('.bt-field img.bt-sprite').evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).map((img) => ({ scale: img.getBoundingClientRect().width / img.naturalWidth, rendering: getComputedStyle(img).imageRendering })),
    )
    expect(scales).toHaveLength(2)
    for (const { scale, rendering } of scales) {
      expect(rendering).toMatch(/pixelated|crisp-edges/)
      const relative = scale / canvasScale
      expect(Math.abs(relative - Math.round(relative)), `escala entera respecto al lienzo (${relative})`).toBeLessThan(0.02)
    }
    expect(field!.height / canvasScale, 'lienzo de la pantalla de batalla = 192 x k').toBeCloseTo(192, 0)
  })
})

test.describe('Red y fuentes', () => {
  test('E2E-19 solo peticiones del mismo origen y fuente local', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const urls: string[] = []
    page.on('request', (request) => urls.push(request.url()))
    const problems = collectProblems(page)
    const { battle } = await startBattle(page, { date: D0, seed: 'a' })
    await battle.waitForActionOrResult()
    await page.waitForLoadState('networkidle')

    const foreign = urls.filter((url) => !/^(data|blob|about):/.test(url) && new URL(url).origin !== origin)
    expect(foreign, 'peticiones a otros orígenes').toEqual([])
    expect(urls.some((url) => /\.ttf$/.test(new URL(url).pathname)), 'la fuente se pide al propio sitio').toBe(true)
    expect(await page.evaluate(() => document.fonts.check('16px "Game"')), 'la fuente del juego está disponible').toBe(true)
    expect(problems).toEqual([])
  })
})
