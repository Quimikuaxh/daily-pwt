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
/** Marco de consola (DS sencilla) en escritorio: carcasa más bisel a cada lado, en píxeles de pantalla. */
export const CONSOLE_FRAME_X = 36
export const CONSOLE_FRAME_Y = 32

/** `frame`: hay sitio para el marco de consola sin bajar la escala del lienzo (solo en el diseño ancho). */
export type StageScale = { scale: number; wide: boolean; frame: boolean }

/**
 * Escala del lienzo 256x384 (RNF-06, PRD §0 "Escala del combate en móvil"). Por debajo de x2 el lienzo ocupa todo el ancho disponible con escala
 * fraccionaria (el pixel art se ve sin suavizar: `image-rendering: pixelated`); a partir de x2 solo múltiplos enteros, que no deforman los píxeles.
 * Nunca baja de 1 y no crece por encima de MAX_SCALE. Siempre cabe entero (ancho y alto) en la ventana. El marco de consola solo se pone si
 * cabe alrededor sin cambiar la escala (decisión de Jose, 22/10/2026: la nitidez manda sobre el marco).
 */
export function stageScaleFor(containerWidth: number, viewportHeight: number): StageScale {
  const wide = containerWidth >= WIDE_LAYOUT_MIN_WIDTH
  const availableWidth = containerWidth - (wide ? SIDE_COLUMN_WIDTH : 0)
  const availableHeight = viewportHeight - (wide ? OUTER_MARGIN : STACKED_CHROME_HEIGHT + OUTER_MARGIN)
  const fits = Math.min(availableWidth / SCREEN_WIDTH, availableHeight / STAGE_HEIGHT)
  const scale = fits >= INTEGER_FROM_SCALE ? Math.min(MAX_SCALE, Math.floor(fits)) : Math.max(1, Math.floor(fits * SCALE_PRECISION) / SCALE_PRECISION)
  const frame = wide && availableWidth - SCREEN_WIDTH * scale >= 2 * CONSOLE_FRAME_X && availableHeight - STAGE_HEIGHT * scale >= 2 * CONSOLE_FRAME_Y
  return { scale, wide, frame }
}

export function useStageScale(containerRef: RefObject<HTMLElement | null>): StageScale {
  const [stage, setStage] = useState({ scale: 1, wide: false, frame: false } as StageScale)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => {
      const next = stageScaleFor(container.clientWidth, window.innerHeight)
      setStage((previous) => (previous.scale === next.scale && previous.wide === next.wide && previous.frame === next.frame ? previous : next))
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
