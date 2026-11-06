import { describe, expect, it } from 'vitest'
import { CONSOLE_FRAME_X, MAX_SIDE_ZOOM, SCREEN_WIDTH, SIDE_PANEL_WIDTH, STAGE_HEIGHT, stageScaleFor } from './useStageScale'

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
    expect(stageScaleFor(1280, 800)).toEqual({ scale: 2, wide: true, frame: false, layout: 'wide', sideZoom: 1 })
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
    // Cambio de requisito (RF-44c, Jose 05/11/2026): con sitio, el diseño es el de los paneles laterales, con el marco igual que antes.
    // Y desde el 06/11/2026 (Jose), con el zoom de los paneles.
    expect(stageScaleFor(1440, 900)).toEqual({ scale: 2, wide: true, frame: true, layout: 'panels', sideZoom: 1.15 })
    expect(stageScaleFor(1920, 1080)).toEqual({ scale: 2, wide: true, frame: true, layout: 'panels', sideZoom: 1.3 })
    expect(stageScaleFor(360, 740).frame, 'móvil: nunca').toBe(false)
  })

  // UT-152 · Paneles laterales (RF-44c): solo si con ellos la escala es la misma que sin ellos y al menos x2.
  it('paneles laterales: con sitio a los lados y sin bajar la escala de la consola', () => {
    expect(stageScaleFor(1440, 900).layout).toBe('panels')
    expect(stageScaleFor(1920, 1080).layout).toBe('panels')
    expect(stageScaleFor(1280, 800).layout, 'con los paneles bajaría de x2').toBe('wide')
    expect(stageScaleFor(1366, 768).layout, 'portátil bajo: la escala ya es menor que x2').toBe('wide')
    expect(stageScaleFor(1100, 1200).layout, 'estrecho para dos paneles').toBe('wide')
    expect(stageScaleFor(360, 740).layout).toBe('stacked')
    // A 2560x1440 sin paneles saldría x3; con ellos, también: se ponen.
    expect(stageScaleFor(2560, 1440)).toMatchObject({ scale: 3, layout: 'panels' })
  })

  // UT-157 (Jose, 06/11/2026): con sitio de sobra los paneles crecen hasta x1,3, sin pisar la consola ni salirse de alto.
  it('zoom de los paneles: hasta x1,3, lo que quepa a lo ancho y a lo alto, nunca menos de 1', () => {
    expect(stageScaleFor(1920, 950).sideZoom, 'pantalla de PC habitual (1920x1080 sin las barras)').toBe(MAX_SIDE_ZOOM)
    expect(stageScaleFor(1440, 900).sideZoom).toBe(1.15)
    expect(stageScaleFor(1920, 850).sideZoom, 'bajo: lo limita el alto').toBe(1.15)
    expect(stageScaleFor(1280, 800).sideZoom, 'sin paneles').toBe(1)
    for (const [width, height] of [[1440, 900], [1600, 900], [1920, 950], [2560, 1440]]) {
      const stage = stageScaleFor(width, height)
      const consoleWidth = SCREEN_WIDTH * stage.scale + (stage.frame ? 2 * CONSOLE_FRAME_X : 0)
      expect(consoleWidth + 2 * (SIDE_PANEL_WIDTH * stage.sideZoom + 20) + 16, `${width}x${height}: no pisa la consola`).toBeLessThanOrEqual(width)
    }
  })
})
