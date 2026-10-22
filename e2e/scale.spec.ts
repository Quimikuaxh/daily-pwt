import { test, expect } from '@playwright/test'
import { stageScale, startBattle } from './support'

// RNF-06 (PRD §0 "Escala del combate en móvil"): fraccionaria a todo el ancho por debajo de x2, entera desde x2.
for (const { width, height } of [{ width: 360, height: 740 }, { width: 400, height: 800 }]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height } })

    test(`E2E-36 el lienzo ocupa todo el ancho (${width} px) con escala fraccionaria y sin suavizar`, async ({ page }) => {
      const { battle } = await startBattle(page, { seed: 'a' })
      await battle.waitForActionOrResult()
      const scale = await stageScale(page)
      expect(scale).toBeCloseTo(width / 256, 1)
      const stage = await page.locator('.bt-ds').boundingBox()
      expect(stage?.width, 'ocupa todo el ancho (la escala se trunca a 0,01)').toBeGreaterThanOrEqual(width - 2)
      expect(stage?.height).toBeLessThanOrEqual(height)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      expect(await page.locator('.bt-ds').evaluate((element) => getComputedStyle(element).imageRendering)).toBe('pixelated')
      expect(await page.locator('.bt-ds img').first().evaluate((element) => getComputedStyle(element).imageRendering)).toBe('pixelated')
    })
  })
}

test.describe('1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('E2E-36 a 1280×800 la escala es entera (2)', async ({ page }) => {
    const { battle } = await startBattle(page, { seed: 'a' })
    await battle.waitForActionOrResult()
    expect(await stageScale(page)).toBeCloseTo(2, 3)
  })
})
