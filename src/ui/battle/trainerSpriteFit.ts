import type { CSSProperties } from 'react'
import type { Point } from './throwGeometry'

/**
 * Ajuste del sprite de combate de algunos entrenadores (Jose, 22/11/2026). Ciprián y Sachiko acaban su animación agachados, en un GIF
 * mucho más ancho que su figura (lleva la entrada saltando): se veían pequeños y, como el sprite se centra por su lienzo, la figura de
 * Ciprián quedaba ~30 px a la izquierda de su plataforma. Se amplían x1,25 y se desplazan para centrar la figura de su pose final.
 * `dx`/`dy`: desplazamiento de la figura respecto al centro inferior del lienzo, en píxeles del sprite (medido en el último fotograma).
 * *Descartado:* ampliar a todos o a todos los agachados (Jose: solo estos dos) y ampliar a una altura fija (quedaban demasiado grandes).
 */
const FIT: Readonly<Record<string, { scale: number; dx: number; dy: number }>> = {
  ciprian: { scale: 1.25, dx: -30.5, dy: -5 },
  sachiko: { scale: 1.25, dx: -5, dy: 0 },
}

/** Transformación del sprite (origen en su centro inferior, donde se apoya), o nada si no lleva ajuste. */
export function trainerSpriteFit(spriteId: string): CSSProperties | undefined {
  const fit = FIT[spriteId]
  if (!fit) return undefined
  return { transform: `translate(${-fit.dx * fit.scale}px, ${-fit.dy * fit.scale}px) scale(${fit.scale})`, transformOrigin: '50% 100%', imageRendering: 'pixelated' }
}

/** Un punto del sprite (p. ej. la mano) con el mismo ajuste, a partir de dónde se apoyan sus pies. */
export function fitPoint(spriteId: string, feet: Point, point: Point): Point {
  const fit = FIT[spriteId]
  if (!fit) return point
  return { x: feet.x - fit.dx * fit.scale + fit.scale * (point.x - feet.x), y: feet.y - fit.dy * fit.scale + fit.scale * (point.y - feet.y) }
}
