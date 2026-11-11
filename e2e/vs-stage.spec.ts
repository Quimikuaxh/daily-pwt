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
  test(`E2E-79 escenario, pancarta con escudo e intro de 8,4 s / x${speed} @timing`, async ({ page }) => {
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
    for (const [end, expected] of [[result.bandAt, 1500 / speed], [result.irisAt, 3500 / speed], [result.doneAt, 8400 / speed]] as const) {
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
