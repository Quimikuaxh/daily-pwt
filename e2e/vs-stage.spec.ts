import { test, expect } from '@playwright/test'
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/storage/settings'
import { MISTY, startBattle } from './support'

type VsSequence = {
  stageAt?: number
  bandAt?: number
  irisAt?: number
  doneAt?: number
  stageLabel?: string | null
  bandLabel?: string | null
  stage?: { player: string; rival: string; playerPortrait: string | null; rivalPortrait: string | null; playerSide: string | null; rivalSide: string | null; playerLeft: boolean; portraitLeft: boolean }
  emblem?: string | null
  logo?: string | null
}

for (const speed of [1, 2, 4] as const) {
  test(`E2E-79 escenario, pancarta con escudo e intro de 8,9 s / x${speed} @timing`, async ({ page }) => {
    // Observar desde el montaje evita perder el escenario a x4 por la latencia de los selectores.
    await page.addInitScript(({ key, settings }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, ...settings }))
      const result: VsSequence = {}
      ;(window as unknown as { __vsSequence: VsSequence }).__vsSequence = result
      new MutationObserver(() => {
        const banner = document.querySelector('.bt-vs')
        const stage = banner?.querySelector(':scope > .bt-vs-stage')
        const src = (root: Element, selector: string) => root.querySelector(selector)?.getAttribute('src') ?? null
        if (stage && result.stageAt === undefined) {
          result.stageAt = performance.now()
          result.stageLabel = banner!.getAttribute('aria-label')
          result.stage = {
            player: stage.querySelector('.bt-vs-stage-plate-top')!.textContent!,
            rival: stage.querySelector('.bt-vs-stage-plate-bottom')!.textContent!,
            playerPortrait: src(stage, '.bt-vs-stage-portrait-left img'),
            rivalPortrait: src(stage, '.bt-vs-stage-portrait-right img'),
            playerSide: src(stage, '.bt-vs-stage-trainer-left'),
            rivalSide: src(stage, '.bt-vs-stage-trainer-right'),
            playerLeft: stage.querySelector('.bt-vs-stage-trainer-left')!.getBoundingClientRect().x < stage.querySelector('.bt-vs-stage-trainer-right')!.getBoundingClientRect().x,
            portraitLeft: stage.querySelector('.bt-vs-stage-portrait-left')!.getBoundingClientRect().x < stage.querySelector('.bt-vs-stage-portrait-right')!.getBoundingClientRect().x,
          }
        }
        if (banner?.querySelector('.bt-vs-band') && result.bandAt === undefined) {
          result.bandAt = performance.now()
          result.bandLabel = banner.getAttribute('aria-label')
          result.emblem = src(banner, '.bt-vs-fence .bt-vs-emblem')
          result.logo = src(banner, '.bt-vs-logo')
        }
        const phase = document.querySelector('[data-testid=field]')?.getAttribute('data-intro')
        if (phase === 'iris' && result.irisAt === undefined) result.irisAt = performance.now()
        if (phase === 'done' && result.doneAt === undefined) result.doneAt = performance.now()
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-intro'] })
    }, { key: SETTINGS_KEY, settings: { ...DEFAULT_SETTINGS, speed, sound: false } })
    await startBattle(page, { scenario: MISTY, seed: 'a' })
    await expect(page.getByTestId('field')).toHaveAttribute('data-intro', 'done', { timeout: 20_000 })
    const result = await page.evaluate(() => (window as unknown as { __vsSequence: VsSequence }).__vsSequence)
    expect(result.stage).toEqual({
      player: 'Rosa', rival: 'Misty', playerLeft: true, portraitLeft: true,
      playerPortrait: expect.stringMatching(/\/trainers\/rosa-vs\.png$/),
      rivalPortrait: expect.stringMatching(/\/trainers\/misty-vs\.png$/),
      playerSide: expect.stringMatching(/\/trainers\/rosa-side\.png$/),
      rivalSide: expect.stringMatching(/\/trainers\/misty-side\.png$/),
    })
    expect(result.stageLabel).toBe('Rosa contra Misty')
    expect(result.bandLabel).toBe(result.stageLabel)
    expect(result.emblem).toMatch(/\/vs-emblem\.png$/)
    expect(result.logo).toMatch(/\/vs-logo\.png$/)
    for (const [end, expected] of [[result.bandAt, 2000 / speed], [result.irisAt, 4000 / speed], [result.doneAt, 8900 / speed]] as const) {
      expect(end, 'se observó la fase').toBeDefined()
      const elapsed = end! - result.stageAt!
      expect(elapsed).toBeGreaterThanOrEqual(expected - 50)
      expect(elapsed).toBeLessThanOrEqual(expected + 800)
    }
  })
}

for (const animations of ['never', 'system'] as const) {
  test(`E2E-80 con animaciones ${animations} y movimiento reducido la pancarta aparece compuesta sin escenario previo`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(({ key, settings }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, ...settings }))
    }, { key: SETTINGS_KEY, settings: { ...DEFAULT_SETTINGS, animations, sound: false } })
    await startBattle(page, { scenario: MISTY, seed: 'a' })
    const banner = page.getByRole('img', { name: 'Rosa contra Misty', exact: true })
    await expect(banner).toBeVisible()
    await expect(banner.locator(':scope > .bt-vs-stage')).toHaveCount(0)
    await expect(banner.locator('.bt-vs-band')).toHaveCount(2)
    await expect(banner.locator('.bt-vs-emblem')).toBeVisible()
    await expect(banner.locator('.bt-vs-logo')).toHaveCSS('opacity', '1')
    await expect(banner.locator('.bt-vs-trainer').first()).toHaveCSS('filter', 'none')
  })
}

test('E2E-81 el fundido a negro de la pancarta cuenta desde que entra la franja, no desde el escenario', async ({ page }) => {
  await page.addInitScript(({ key, settings }) => localStorage.setItem(key, JSON.stringify({ version: 1, ...settings })),
    { key: SETTINGS_KEY, settings: { ...DEFAULT_SETTINGS, speed: 1, sound: false } })
  await startBattle(page, { scenario: MISTY, seed: 'a' })
  await page.locator('.bt-vs-band').first().waitFor({ timeout: 20_000 })
  // Con la Animation API, sin esperas reales (con la máquina cargada, 1 s de espera podía llegar tarde): el fundido arranca con la franja,
  // no con el escenario, y no empieza hasta los 1583 ms.
  const timing = await page.evaluate(() => {
    const animation = (selector: string, name: string) => document.querySelector(selector)!.getAnimations().find((a) => (a as CSSAnimation).animationName === name)!
    const fade = animation('.bt-vs-fade', 'bt-vs-fade')
    const band = animation('.bt-vs-band-player', 'bt-vs-in-left')
    return { gap: Math.abs(Number(fade.startTime) - Number(band.startTime)), delay: Number(fade.effect!.getComputedTiming().delay) }
  })
  expect(timing.gap).toBeLessThan(50)
  expect(timing.delay).toBeGreaterThanOrEqual(1500)
})

test('E2E-82 en la pancarta el jugador entra desde la izquierda y el rival desde la derecha, con el mismo recorrido', async ({ page }) => {
  await page.addInitScript(({ key, settings }) => localStorage.setItem(key, JSON.stringify({ version: 1, ...settings })),
    { key: SETTINGS_KEY, settings: { ...DEFAULT_SETTINGS, speed: 1, sound: false } })
  await startBattle(page, { scenario: MISTY, seed: 'a' })
  await page.locator('.bt-vs-band').first().waitFor({ timeout: 20_000 })
  // Congela la entrada del retrato (bt-vs-trainer-in) al principio y al final y mide el centro de cada uno en pantalla.
  const travel = await page.evaluate(() => {
    const centre = (img: Element) => { const r = img.getBoundingClientRect(); return r.x + r.width / 2 }
    return (['player', 'rival'] as const).map((side) => {
      const img = document.querySelector(`.bt-vs-band-${side} .bt-vs-trainer`)!
      const entry = img.getAnimations().find((a) => (a as CSSAnimation).animationName === 'bt-vs-trainer-in')!
      entry.pause()
      const timing = entry.effect!.getComputedTiming()
      entry.currentTime = Number(timing.delay)
      const start = centre(img)
      entry.currentTime = Number(timing.endTime) - 1
      return centre(img) - start
    })
  })
  const [player, rival] = travel
  expect(player, 'el jugador avanza hacia la derecha').toBeGreaterThan(0)
  expect(rival, 'el rival avanza hacia la izquierda').toBeLessThan(0)
  expect(Math.abs(Math.abs(player) - Math.abs(rival))).toBeLessThan(2)
})
