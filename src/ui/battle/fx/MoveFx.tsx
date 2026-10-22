import { useEffect, useLayoutEffect, useRef } from 'react'
import moveFxKinds from '../../../generated/move-fx.json'
import { Prng } from '../../../core/prng'
import { effectFor, SELF_KINDS, type FxContext, type FxKind, type Painter, type Point } from './effects'
import { fxColorsFor } from './fxColors'

/** Un movimiento que se está usando: lo pone useBattle al mostrar «X usó Y». `key` cambia en cada uso (el mismo movimiento dos veces se anima dos veces). */
export type MoveFxEvent = { key: number; moveId: string; user: 'player' | 'rival' }

type MoveFxProps = {
  event: MoveFxEvent | null
  type: string | null
  /** Centro visible de cada Pokémon en la pantalla de arriba. */
  points: { player: Point; rival: Point }
  speed: number
  /** Campo (pantalla de arriba): de él se mueven los sprites o la pantalla entera cuando el efecto tiembla. */
  fieldRef: { current: HTMLElement | null }
}

const WIDTH = 256
const HEIGHT = 192

const MOVE_FX_KINDS = moveFxKinds as { [moveId: string]: FxKind | undefined }
const kindOf = (moveId: string): FxKind => MOVE_FX_KINDS[moveId] ?? 'foe'

/** Pinta en coordenadas enteras: el lienzo va con `image-rendering: pixelated` y a escala del resto del combate. */
function painterFor(context: CanvasRenderingContext2D): Painter {
  return {
    dot(x, y, size, color) {
      context.fillStyle = color
      context.fillRect(Math.round(x), Math.round(y), size, size)
    },
  }
}

function shakeTargetElement(field: HTMLElement | null, who: 'user' | 'target' | 'screen', user: 'player' | 'rival'): HTMLElement | null {
  if (!field) return null
  if (who === 'screen') return field
  const side = who === 'user' ? user : user === 'player' ? 'rival' : 'player'
  return field.querySelector<HTMLElement>(`.bt-mon-${side} .bt-sprite`)
}

/**
 * Lienzo de las animaciones de movimientos (DEC-53) sobre los Pokémon y bajo la caja de mensajes. Reproduce el efecto del movimiento con
 * requestAnimationFrame durante su duración (dividida por la velocidad del combate) y se borra al terminar.
 */
export function MoveFx({ event, type, points, speed, fieldRef }: MoveFxProps) {
  const canvasRef = useRef(null as HTMLCanvasElement | null)
  // Posiciones, velocidad y tipo del momento en que empieza el efecto (no lo reinician si cambian a mitad).
  const latest = useRef({ points, speed, type })
  useLayoutEffect(() => {
    latest.current = { points, speed, type }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!event || !canvas || !context) return
    const kind = kindOf(event.moveId)
    const effect = effectFor(event.moveId, kind)
    const { points: at, speed: rate, type: moveType } = latest.current
    const opponent = event.user === 'player' ? 'rival' : 'player'
    const user = at[event.user]
    const target = SELF_KINDS.has(kind) ? at[event.user] : at[opponent]
    const colors = fxColorsFor(moveType ?? 'Normal')
    const paint = painterFor(context)
    const duration = effect.duration / rate
    let shaken: HTMLElement | null = null
    let frame = 0
    const start = performance.now()

    const clearShake = () => {
      if (shaken) shaken.style.translate = ''
      shaken = null
    }
    const render = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      context.clearRect(0, 0, WIDTH, HEIGHT)
      const fx: FxContext = { user, target, type: moveType ?? 'Normal', ...colors, random: seeded(event.moveId) }
      effect.draw(paint, progress, fx)
      const shake = effect.shake?.(progress) ?? null
      clearShake()
      if (shake) {
        shaken = shakeTargetElement(fieldRef.current, shake.who, event.user)
        if (shaken) shaken.style.translate = `${shake.dx}px ${shake.dy}px`
      }
      if (progress < 1) frame = requestAnimationFrame(render)
      else context.clearRect(0, 0, WIDTH, HEIGHT)
    }
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      clearShake()
      context.clearRect(0, 0, WIDTH, HEIGHT)
    }
  }, [event, fieldRef])

  return <canvas ref={canvasRef} className="bt-fx" width={WIDTH} height={HEIGHT} aria-hidden="true" data-move={event?.moveId} />
}

/** Azar determinista por movimiento, nuevo en cada fotograma (mismas posiciones fotograma a fotograma). */
function seeded(moveId: string): () => number {
  const prng = new Prng(`fx:${moveId}`)
  return () => prng.next()
}
