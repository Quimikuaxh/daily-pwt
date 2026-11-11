/**
 * Gestos de Equipo y PC: arrastrar con puntero (ratón y táctil; más de 4 px es arrastre, si no, un toque), claves de hueco para el DOM
 * (`data-place`) y movimiento del foco con las flechas (en la caja, de 6 en 6 por filas; en el equipo, de uno en uno).
 */
import { useRef, useState, type PointerEvent } from 'react'
import { BOX_SIZE, PARTY_SIZE, type Place } from './teamModel'

const DRAG_THRESHOLD = 4

export const placeKey = (place: Place): string => place.area === 'party' ? `party-${place.i}` : `box-${place.i}`

export function placeOf(key: string | undefined, box: number): Place | null {
  const match = /^(party|box)-(\d+)$/.exec(key ?? '')
  if (!match) return null
  const i = Number(match[2])
  return match[1] === 'party' ? { area: 'party', i } : { area: 'box', box, i }
}

export function arrowTarget(place: Place, key: string): Place | null {
  const deltas: Record<string, number> = place.area === 'box'
    ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 }
    : { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }
  const delta = deltas[key]
  if (delta === undefined) return null
  const i = Math.max(0, Math.min((place.area === 'box' ? BOX_SIZE : PARTY_SIZE) - 1, place.i + delta))
  return { ...place, i }
}

export type Dragging = { from: Place; x: number; y: number; scale: number }

type DragOptions = {
  /** Caja a la vista: un destino en la caja es siempre de esta. */
  box: number
  canDrag: (place: Place) => boolean
  onDrop: (from: Place, to: Place) => void
  onTap: (place: Place) => void
}

export function useMonDrag({ box, canDrag, onDrop, onTap }: DragOptions) {
  const [dragging, setDragging] = useState(null as Dragging | null)
  const start = useRef(null as { place: Place; x: number; y: number; scale: number; moved: boolean } | null)
  const justDragged = useRef(false)

  const handlers = (place: Place) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !canDrag(place)) return
      const stage = event.currentTarget.closest<HTMLElement>('.console-stage')
      start.current = { place, x: event.clientX, y: event.clientY, scale: Number(stage?.dataset.scale ?? 2), moved: false }
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const s = start.current
      if (!s) return
      if (!s.moved && Math.hypot(event.clientX - s.x, event.clientY - s.y) <= DRAG_THRESHOLD) return
      s.moved = true
      setDragging({ from: s.place, x: event.clientX, y: event.clientY, scale: s.scale })
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const s = start.current
      start.current = null
      if (!s?.moved) return
      setDragging(null)
      justDragged.current = true
      setTimeout(() => { justDragged.current = false }, 0)
      const doc = event.currentTarget.ownerDocument
      const target = doc.elementsFromPoint(event.clientX, event.clientY).find((node) => node instanceof HTMLElement && node.dataset.place) as HTMLElement | undefined
      const to = placeOf(target?.dataset.place, box)
      if (to) onDrop(s.place, to)
    },
    onPointerCancel: () => {
      start.current = null
      setDragging(null)
    },
    onClick: () => {
      if (!justDragged.current) onTap(place)
    },
  })

  return { dragging, handlers }
}

/**
 * Ventana del menú del PC (AddMenu de pokemon_storage_system.c), en teselas: ancho = letras de la opción más larga + 2, alto = 2 por
 * opción, y la esquina inferior derecha en la columna 29 y la fila 15 de la pantalla de arriba.
 */
export function pcMenuWindow(labels: readonly string[]): { x: number; y: number; width: number; height: number } {
  const width = Math.max(...labels.map((label) => [...label].length)) + 2
  const height = 2 * labels.length
  return { x: 29 - width, y: 15 - height, width, height }
}
