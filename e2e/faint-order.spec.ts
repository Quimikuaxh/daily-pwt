import { test, expect } from '@playwright/test'
import { startBattle } from './support'

type Sample = { time: number; side: 'player' | 'rival'; fainted: boolean; fill: number; opacity: number; message: string }

const SAMPLE_INTERVAL_MS = 50
const FLIPS_TO_OBSERVE = 2
const MAX_DECISIONS = 40

/**
 * DEC-42: en tiempo real (sin page.clock), la barra de PS llega a 0 antes de que el sprite empiece a caer y el mensaje
 * «se ha debilitado» ya está en pantalla cuando cae. Con la vista marcando «debilitado» en el propio golpe, el sprite se
 * desvanecía con la barra a medias.
 */
test.describe('Orden del debilitado: barra a 0 -> mensaje -> el sprite cae', () => {
  for (const speedClicks of [0, 1, 2]) {
    const speed = 2 ** speedClicks
    test(`E2E-51 a velocidad x${speed} @timing`, async ({ page }) => {
      test.setTimeout(300_000)
      await page.addInitScript((interval) => {
        const samples: unknown[] = []
        ;(window as unknown as { __faintSamples: unknown[] }).__faintSamples = samples
        const start = performance.now()
        window.setInterval(() => {
          const message = document.querySelector('[data-testid=field] [role=status]')?.textContent ?? ''
          for (const side of ['player', 'rival'] as const) {
            const mon = document.querySelector(`.bt-mon-${side}`)
            const sprite = mon?.querySelector('.bt-sprite')
            const box = document.querySelector(`[data-testid=${side}-hp]`) as HTMLElement | null
            if (!mon || !sprite || !box) continue
            samples.push({
              time: Math.round(performance.now() - start),
              side,
              fainted: mon.getAttribute('data-fainted') === 'true',
              fill: parseInt(box.style.getPropertyValue('--fill'), 10),
              opacity: Number(getComputedStyle(sprite).opacity),
              message,
            })
          }
        }, interval)
      }, SAMPLE_INTERVAL_MS)

      const { battle } = await startBattle(page, { seed: 'a' })
      for (let index = 0; index < speedClicks; index += 1) await battle.speedButton.click()
      const readSamples = () => page.evaluate(() => (window as unknown as { __faintSamples: Sample[] }).__faintSamples)
      const countFlips = (samples: Sample[]) =>
        (['player', 'rival'] as const).reduce((total, side) => {
          const own = samples.filter((sample) => sample.side === side)
          return total + own.filter((sample, index) => sample.fainted && index > 0 && !own[index - 1].fainted).length
        }, 0)

      for (let decisions = 0; decisions < MAX_DECISIONS; decisions += 1) {
        if ((await battle.decide()) === 'result') break
        if (countFlips(await readSamples()) >= FLIPS_TO_OBSERVE) break
      }
      const samples = await readSamples()
      expect(countFlips(samples), 'debilitados observados').toBeGreaterThanOrEqual(1)

      for (const side of ['player', 'rival'] as const) {
        const own = samples.filter((sample) => sample.side === side)
        own.forEach((sample, index) => {
          if (!sample.fainted || index === 0 || own[index - 1].fainted) return
          expect(sample.fill, `${side}: la barra ya está a 0 cuando el sprite pasa a debilitado (t=${sample.time})`).toBe(0)
          expect(sample.message, `${side}: el mensaje «se ha debilitado» ya se ve cuando cae`).toMatch(/debilitado/)
          expect(own[index - 1].opacity, `${side}: el sprite seguía opaco justo antes`).toBeGreaterThanOrEqual(0.99)
        })
      }
    })
  }
})
