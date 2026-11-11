import { useEffect, useState, type RefObject } from 'react'

/** Cada pantalla de la DS mide 256x192; el lienzo lógico apila la de batalla y la táctil. */
export const SCREEN_WIDTH = 256
export const SCREEN_HEIGHT = 192
export const STAGE_HEIGHT = SCREEN_HEIGHT * 2
const MAX_SCALE = 4
/** A partir de esta escala solo se usan enteros. */
const INTEGER_FROM_SCALE = 2
const SCALE_PRECISION = 100

/** Con la ventana ancha los controles (Salir, Registro, Velocidad...) van a un lado; si no, encima del lienzo. */
const WIDE_LAYOUT_MIN_WIDTH = 700
const SIDE_COLUMN_WIDTH = 304
const STACKED_CHROME_HEIGHT = 84
const OUTER_MARGIN = 16
/** Paneles laterales (RF-44c, DEC-81): ancho de cada uno, hueco hasta la consola y alto de la barra de botones, que va encima. */
export const SIDE_PANEL_WIDTH = 340
const SIDE_PANEL_GAP = 20
const PANELS_BAR_HEIGHT = 52
/**
 * Con sitio de sobra los paneles crecen (Jose, 06/11/2026: a 1920 x 1080 se leían pequeños), hasta x1,3 y sin pisar la consola ni salirse
 * de alto: a x1 la columna más alta (panel y ficha con una descripción larga) mide unos 700 px. Va en pasos de 0,05.
 */
export const MAX_SIDE_ZOOM = 1.3
const SIDE_COLUMN_BASE_HEIGHT = 700
const PANELS_PADDING_X = 16
/** Marco de consola (DS sencilla) en escritorio: carcasa más bisel a cada lado, en píxeles de pantalla. */
export const CONSOLE_FRAME_X = 36
export const CONSOLE_FRAME_Y = 32

/**
 * `frame`: hay sitio para el marco de consola sin bajar la escala del lienzo (solo en el diseño ancho). `layout`: `stacked` (botones
 * encima y contadores debajo), `wide` (botones y contadores en una columna a la derecha) o `panels` (paneles laterales a los dos lados y la
 * barra encima de la consola). `wide` es cierto en los dos últimos.
 */
export type StageLayout = 'stacked' | 'wide' | 'panels'
export type StageScale = { scale: number; wide: boolean; frame: boolean; layout: StageLayout; sideZoom: number }

/**
 * Escala de un lienzo lógico de `width` x `height` en el hueco disponible, con la regla del reto diario (RNF-06): entera desde x2 y hasta
 * MAX_SCALE; por debajo, la fraccionaria que quepa (con dos decimales), nunca menos de 1. La usan también los temas de consola de otros juegos
 * (src/ui/console, DEC-95).
 */
export function consoleScale(availableWidth: number, availableHeight: number, width: number, height: number): number {
  const fits = Math.min(availableWidth / width, availableHeight / height)
  return fits >= INTEGER_FROM_SCALE ? Math.min(MAX_SCALE, Math.floor(fits)) : Math.max(1, Math.floor(fits * SCALE_PRECISION) / SCALE_PRECISION)
}

const fitScale = (availableWidth: number, availableHeight: number): number => consoleScale(availableWidth, availableHeight, SCREEN_WIDTH, STAGE_HEIGHT)

/** Cuánto crecen los paneles con la consola a `scale` (con su marco si lo lleva): lo que quepa a lo ancho y a lo alto, entre 1 y x1,3. */
export function sideZoomFor(containerWidth: number, viewportHeight: number, scale: number, frame: boolean): number {
  const consoleWidth = SCREEN_WIDTH * scale + (frame ? 2 * CONSOLE_FRAME_X : 0)
  const byWidth = (containerWidth - PANELS_PADDING_X - consoleWidth - 2 * SIDE_PANEL_GAP) / (2 * SIDE_PANEL_WIDTH)
  const byHeight = (viewportHeight - OUTER_MARGIN) / SIDE_COLUMN_BASE_HEIGHT
  return Math.max(1, Math.min(MAX_SIDE_ZOOM, Math.floor(Math.min(byWidth, byHeight) * 20) / 20))
}

const frameFits = (availableWidth: number, availableHeight: number, scale: number): boolean =>
  availableWidth - SCREEN_WIDTH * scale >= 2 * CONSOLE_FRAME_X && availableHeight - STAGE_HEIGHT * scale >= 2 * CONSOLE_FRAME_Y

/**
 * Escala del lienzo 256x384 (RNF-06, PRD §0 "Escala del combate en móvil"). Por debajo de x2 el lienzo ocupa todo el ancho disponible con escala
 * fraccionaria (el pixel art se ve sin suavizar: `image-rendering: pixelated`); a partir de x2 solo múltiplos enteros, que no deforman los píxeles.
 * Nunca baja de 1 y no crece por encima de MAX_SCALE. Siempre cabe entero (ancho y alto) en la ventana. El marco de consola solo se pone si
 * cabe alrededor sin cambiar la escala (decisión de Jose, 22/10/2026: la nitidez manda sobre el marco). Los paneles laterales, igual: solo
 * si con ellos la escala es la misma que sin ellos y al menos x2 (RF-44c).
 */
export function stageScaleFor(containerWidth: number, viewportHeight: number): StageScale {
  const wide = containerWidth >= WIDE_LAYOUT_MIN_WIDTH
  const availableWidth = containerWidth - (wide ? SIDE_COLUMN_WIDTH : 0)
  const availableHeight = viewportHeight - (wide ? OUTER_MARGIN : STACKED_CHROME_HEIGHT + OUTER_MARGIN)
  const scale = fitScale(availableWidth, availableHeight)
  if (wide) {
    const panelsWidth = containerWidth - 2 * (SIDE_PANEL_WIDTH + SIDE_PANEL_GAP)
    const panelsHeight = viewportHeight - OUTER_MARGIN - PANELS_BAR_HEIGHT
    const panelsScale = fitScale(panelsWidth, panelsHeight)
    if (panelsScale >= INTEGER_FROM_SCALE && panelsScale >= scale) {
      const frame = frameFits(panelsWidth, panelsHeight, panelsScale)
      return { scale: panelsScale, wide, frame, layout: 'panels', sideZoom: sideZoomFor(containerWidth, viewportHeight, panelsScale, frame) }
    }
  }
  return { scale, wide, frame: wide && frameFits(availableWidth, availableHeight, scale), layout: wide ? 'wide' : 'stacked', sideZoom: 1 }
}

export function useStageScale(containerRef: RefObject<HTMLElement | null>): StageScale {
  const [stage, setStage] = useState({ scale: 1, wide: false, frame: false, layout: 'stacked', sideZoom: 1 } as StageScale)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => {
      const next = stageScaleFor(container.clientWidth, window.innerHeight)
      setStage((previous) => (previous.scale === next.scale && previous.layout === next.layout && previous.frame === next.frame && previous.sideZoom === next.sideZoom ? previous : next))
    }
    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(container)
    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [containerRef])

  return stage
}
