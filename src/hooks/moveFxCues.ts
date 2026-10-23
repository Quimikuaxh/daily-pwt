import { toId } from '../core/id'

type Side = 'player' | 'rival'
/** Qué se anima y sobre quién: `user` lo lanza, `target` lo recibe (el mismo bando si es sobre sí mismo). */
export type FxCue = { moveId: string; user: Side; target: Side | null }

const sideOf = (ref: string): Side | null => {
  const side = /^p([12])/.exec(ref)?.[1]
  return side === '1' ? 'player' : side === '2' ? 'rival' : null
}

const tagOf = (parts: readonly string[], tag: string): string | null => {
  const found = parts.find((part) => part.startsWith(`[${tag}]`))
  return found ? found.slice(tag.length + 2).trim() : null
}

/**
 * `|move|p1a: X|Earthquake|p2a: Y` -> el movimiento, quién lo usa y a quién va (Maldición, Danza Espada… van al propio usuario: el
 * simulador lo pone de objetivo). Se anima a la vez que «X usó Y» (decisión de Jose). No se anima si falla (`[miss]`), si no hace nada
 * visible en este turno (`[still]`, carga) o si no hay objetivo (`[notarget]`).
 */
export function usedMove(line: string): FxCue | null {
  const [, type, actor = '', name = '', target = '', ...rest] = line.split('|')
  if (type !== 'move' || [target, ...rest].some((part) => /^\[(miss|still|notarget)\]/.test(part))) return null
  const user = sideOf(actor)
  if (!user || !name) return null
  return { moveId: toId(name), user, target: sideOf(target) }
}

const STATUS_FX: Record<string, string> = { brn: 'brn', psn: 'psn', tox: 'psn', par: 'par', slp: 'slp', frz: 'frz', confusion: 'confusion' }

/**
 * Animación de un estado sobre el Pokémon que lo sufre, con su mensaje (decisión de Jose): al caer en él (`-status`, `-start` confusión),
 * cuando le impide moverse (`cant`), cuando le hace daño (`-damage [from] brn|psn|tox`) y cuando avisa de que sigue confuso (`-activate`).
 * También los cambios de características (`-boost`, `-unboost`: flechas que suben o bajan) y la baya que sube una (`-boost [from] item: …
 * Berry`): se la come y le suben las flechas.
 */
export function conditionFx(line: string): FxCue | null {
  const [, type = '', ref = '', what = '', ...rest] = line.split('|')
  const side = sideOf(ref)
  if (!side) return null
  const on = (moveId: string): FxCue => ({ moveId, user: side, target: side })
  const status = (id: string) => (STATUS_FX[id] ? on(`status:${STATUS_FX[id]}`) : null)
  switch (type) {
    case '-status':
      return status(toId(what))
    case 'cant':
      return toId(what) === 'slp' || toId(what) === 'par' || toId(what) === 'frz' ? status(toId(what)) : null
    case '-damage': {
      const from = tagOf(rest, 'from')
      return from ? status(toId(from)) : null
    }
    case '-start':
    case '-activate':
      return toId(what) === 'confusion' ? status('confusion') : null
    case '-boost':
    case '-unboost': {
      // «No puede subir/bajar más» llega con 0 niveles: sin flechas.
      if (Number(rest[0]) === 0) return null
      const from = tagOf(rest, 'from') ?? ''
      if (type === '-boost' && /^item:/.test(from) && toId(from.replace(/^item:\s*/, '')).endsWith('berry')) return on('item:berry')
      return on(type === '-boost' ? 'stat:up' : 'stat:down')
    }
    default:
      return null
  }
}

/** Líneas que terminan una acción: tras ellas, un `-damage` ya no es otro golpe del mismo movimiento. */
const ACTION_END = new Set(['move', 'turn', 'upkeep', 'switch', 'drag', 'cant', 'faint', 'win', 'tie', ''])

/**
 * Golpes de un movimiento de varios golpes (Pedrada, Doble Patada…): el simulador manda un `-damage` sin `[from]` por golpe. Desde el
 * segundo, se repite la animación del movimiento antes de que baje la vida (decisión de Jose: animación completa por golpe).
 */
export function createMultiHitTracker() {
  let current: (FxCue & { hits: number }) | null = null
  return {
    /** Devuelve la animación que hay que repetir antes de aplicar esta línea, o `null`. */
    next(line: string): FxCue | null {
      const [, type = '', ref = '', , ...rest] = line.split('|')
      if (type === 'move') {
        const used = usedMove(line)
        current = used && used.target && used.target !== used.user ? { ...used, hits: 0 } : null
        return null
      }
      if (ACTION_END.has(type)) {
        current = null
        return null
      }
      if (type !== '-damage' || !current || sideOf(ref) !== current.target || tagOf(rest, 'from') !== null) return null
      current.hits += 1
      return current.hits >= 2 ? { moveId: current.moveId, user: current.user, target: current.target } : null
    },
  }
}
