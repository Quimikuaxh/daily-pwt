import { test, expect } from '@playwright/test'
import { startBattle } from './support'

type Sample = { time: number; phase: string | null; irisOpacity: number | null; rival: number; player: number }
type Timing = { durationMs: number; start: number; final: number; visibleMs: number; distinctPositions: number }

const SAMPLE_INTERVAL_MS = 50
const MIN_VISIBLE_SLIDE_MS = 400
const MIN_INTERMEDIATE_POSITIONS = 3
const MIN_SLIDE_DURATION_MS = 600
const POSITION_TOLERANCE_PX = 2
const SCRUB_STEP_MS = 10

/**
 * Se mide en tiempo real (sin page.clock, sin saltar la transición): un test con reloj simulado o que solo mire los extremos
 * pasaba con una entrada que en pantalla duraba menos de un par de fotogramas (DEC-30).
 *
 * Qué se mide dónde: que el iris haya terminado y que se vea al menos una posición intermedia, con muestreo en tiempo real (con la máquina
 * cargada el muestreo pierde fotogramas y no sirve para contar más). Las posiciones intermedias distintas y la duración visible
 * (cuánto de la animación ocurre dentro del lienzo) se miden recorriendo la Animation API de la propia animación de entrada
 * (`currentTime` de 0 a su duración, leyendo `getBoundingClientRect` en cada paso): con la máquina cargada (webkit con otros workers) el
 * muestreo pierde los extremos de la animación y daba 258 ms para una animación de 650 ms.
 */
test.describe('Entrada deslizante de los entrenadores (PRD §10.2.1)', () => {
  test('E2E-47 intro: cada entrenador cruza el campo a la vista durante >= 400 ms, y solo cuando el iris ha terminado de revelarlo @timing', async ({ page }) => {
    await page.addInitScript(({ scrubStep, interval }) => {
      const timing: Record<string, unknown> = {}
      ;(window as unknown as { __slideTiming: unknown }).__slideTiming = timing
      const measureAnimation = (side: 'rival' | 'player', element: Element, field: Element) => {
        const animation = element.getAnimations().find((candidate) => (candidate as CSSAnimation).animationName.startsWith('bt-slide-in'))
        if (!animation) return
        const edge = field.getBoundingClientRect()
        const position = () => (side === 'rival' ? element.getBoundingClientRect().left - edge.left : element.getBoundingClientRect().right - edge.left)
        const durationMs = Number(animation.effect!.getComputedTiming().duration)
        const resumeAt = animation.currentTime as number
        animation.pause()
        animation.currentTime = durationMs
        const final = position()
        animation.currentTime = 0
        const start = position()
        let visibleSteps = 0
        const distinct = new Set<number>()
        for (let at = 0; at < durationMs; at += scrubStep) {
          animation.currentTime = at
          const current = position()
          if (current > 0 && current < edge.width && Math.abs(current - final) > 2) {
            visibleSteps += 1
            distinct.add(Math.round(current / 2))
          }
        }
        animation.currentTime = resumeAt
        animation.play()
        timing[side] = { durationMs, start, final, visibleMs: visibleSteps * scrubStep, distinctPositions: distinct.size }
      }
      const samples: unknown[] = []
      ;(window as unknown as { __slideSamples: unknown[] }).__slideSamples = samples
      const start = performance.now()
      window.setInterval(() => {
        const field = document.querySelector('[data-testid=field]')
        const rival = document.querySelector('.bt-trainer-rival')
        const player = document.querySelector('.bt-trainer-player')
        if (!field || !rival || !player) return
        const edge = field.getBoundingClientRect()
        const iris = document.querySelector('.bt-iris')
        if (field.getAttribute('data-intro') === 'enter' && !timing.rival) {
          measureAnimation('rival', rival, field)
          measureAnimation('player', player, field)
        }
        samples.push({
          time: Math.round(performance.now() - start),
          phase: field.getAttribute('data-intro'),
          irisOpacity: iris ? Number(getComputedStyle(iris).opacity) : null,
          rival: rival.getBoundingClientRect().left - edge.left,
          player: player.getBoundingClientRect().right - edge.left,
        })
      }, interval)
    }, { scrubStep: SCRUB_STEP_MS, interval: SAMPLE_INTERVAL_MS })

    await startBattle(page, { seed: 'a' })
    await expect(page.getByTestId('field')).toHaveAttribute('data-intro', 'done', { timeout: 20000 })
    const samples = await page.evaluate(() => (window as unknown as { __slideSamples: Sample[] }).__slideSamples)
    const timing = await page.evaluate(() => (window as unknown as { __slideTiming: Record<'rival' | 'player', Timing> }).__slideTiming)

    const irisSamples = samples.filter((sample) => sample.phase === 'iris')
    const enterSamples = samples.filter((sample) => sample.phase === 'enter')
    expect(irisSamples.length, 'se ve la fase del iris').toBeGreaterThan(0)
    expect(enterSamples.length, 'muestras durante la entrada').toBeGreaterThanOrEqual(2)
    expect(irisSamples.at(-1)!.irisOpacity ?? 0, 'el iris ya ha revelado el campo cuando empieza la entrada').toBeLessThan(0.05)

    const fieldWidth = await page.getByTestId('field').evaluate((field) => field.getBoundingClientRect().width)
    for (const side of ['rival', 'player'] as const) {
      const positions = enterSamples.map((sample) => sample[side])
      const finalPosition = positions.at(-1)!
      const onCanvas = (position: number) => position > 0 && position < fieldWidth
      const isIntermediate = (sample: Sample) => onCanvas(sample[side]) && Math.abs(sample[side] - finalPosition) > POSITION_TOLERANCE_PX
      const intermediateSamples = enterSamples.filter(isIntermediate)
      const intermediate = intermediateSamples.map((sample) => sample[side])
      expect(intermediate.length, `${side}: se le ve en pantalla en una posición intermedia durante el muestreo en tiempo real`).toBeGreaterThanOrEqual(1)
      const own = timing[side]
      expect(own, `${side}: hay animación de entrada`).toBeTruthy()
      expect(own.distinctPositions, `${side}: posiciones x intermedias distintas dentro del lienzo`).toBeGreaterThanOrEqual(MIN_INTERMEDIATE_POSITIONS)
      expect(own.durationMs, `${side}: duración de la animación (ms)`).toBeGreaterThanOrEqual(MIN_SLIDE_DURATION_MS)
      expect(own.visibleMs, `${side}: tiempo (ms) deslizándose dentro del lienzo`).toBeGreaterThanOrEqual(MIN_VISIBLE_SLIDE_MS)
      expect(Math.abs(own.start - own.final), `${side}: arranca lejos de su sitio`).toBeGreaterThan(fieldWidth * 0.2)
      expect(side === 'rival' ? own.start : fieldWidth - own.start, `${side}: arranca en o más allá del borde`).toBeGreaterThanOrEqual(fieldWidth * 0.9)
    }
  })
})
