import { describe, expect, it } from 'vitest'
import { SCREEN_WIDTH, STAGE_HEIGHT, stageScaleFor } from './useStageScale'

// RNF-06 / PRD §0 "Escala del combate en móvil": fraccionaria por debajo de x2 (todo el ancho), entera desde x2.
describe('stageScaleFor', () => {
  it('a 360 px ocupa todo el ancho con escala fraccionaria', () => {
    const { scale, wide } = stageScaleFor(360, 740)
    expect(wide).toBe(false)
    expect(scale).toBeCloseTo(360 / SCREEN_WIDTH, 1)
    expect(Number.isInteger(scale)).toBe(false)
  })

  it('a 400 px también ocupa todo el ancho', () => {
    expect(stageScaleFor(400, 900).scale).toBeCloseTo(400 / SCREEN_WIDTH, 1)
  })

  it('el lienzo escalado nunca es más ancho que el contenedor', () => {
    for (const width of [320, 360, 375, 400, 412, 480, 540]) {
      const { scale } = stageScaleFor(width, 1000)
      expect(SCREEN_WIDTH * scale, `ancho ${width}`).toBeLessThanOrEqual(width + 0.001)
    }
  })

  it('el alto manda si la ventana es baja', () => {
    const { scale } = stageScaleFor(400, 500)
    expect(STAGE_HEIGHT * scale).toBeLessThanOrEqual(500)
    expect(scale).toBeGreaterThanOrEqual(1)
  })

  it('desde x2 solo usa enteros (1280x800 vale 2)', () => {
    expect(stageScaleFor(1280, 800)).toEqual({ scale: 2, wide: true, frame: false })
    for (const [width, height] of [[600, 1000], [1024, 1100], [1920, 1200]]) {
      const { scale } = stageScaleFor(width, height)
      if (scale >= 2) expect(Number.isInteger(scale), `${width}x${height}`).toBe(true)
    }
  })

  it('nunca baja de 1 ni pasa de 4', () => {
    expect(stageScaleFor(200, 300).scale).toBe(1)
    expect(stageScaleFor(4000, 4000).scale).toBe(4)
  })

  it('con la ventana ancha los controles van a un lado', () => {
    expect(stageScaleFor(1280, 800).wide).toBe(true)
    expect(stageScaleFor(360, 740).wide).toBe(false)
  })

  it('marco de consola: solo en el diseño ancho y si cabe sin bajar la escala', () => {
    expect(stageScaleFor(1280, 800), 'a 1280x800 la pantalla ocupa todo el alto: sin marco').toMatchObject({ scale: 2, frame: false })
    expect(stageScaleFor(1440, 900)).toEqual({ scale: 2, wide: true, frame: true })
    expect(stageScaleFor(1920, 1080)).toEqual({ scale: 2, wide: true, frame: true })
    expect(stageScaleFor(360, 740).frame, 'móvil: nunca').toBe(false)
  })
})
