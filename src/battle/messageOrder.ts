import { toId } from '../core/id'

/**
 * El simulador anuncia algunas cosas del golpe antes de su `-damage` (crítico, efectividad, Banda Focus, Robustez…); en N2/B2
 * esos textos salen cuando la barra de PS ya ha bajado. Estas líneas se retrasan hasta justo después del `-damage` del mismo
 * Pokémon dentro de la misma acción, conservando su orden relativo.
 */
function deferredTarget(line: string): string | null {
  const [, type = '', target = '', effect = '', ...rest] = line.split('|')
  const id = toId(effect.replace(/^(move|ability|item):\s*/, ''))
  switch (type) {
    case '-crit':
    case '-supereffective':
    case '-resisted':
      return target
    case '-enditem':
      return id === 'focussash' && rest.length === 0 ? target : null
    case '-ability':
      return id === 'sturdy' && rest.length === 0 ? target : null
    case '-activate':
      return id === 'focusband' || id === 'endure' ? target : null
    default:
      return null
  }
}

// Fin de una acción: lo que quede pendiente (p. ej. golpe a un sustituto, sin `-damage`) sale en su sitio, sin cruzar la frontera.
const ACTION_BOUNDARY = new Set(['', 'move', 'turn', 'upkeep', 'switch', 'drag', 'cant', 'win', 'tie'])

export function deferHitMessages(lines: readonly string[]): string[] {
  const out: string[] = []
  const pending: { target: string; line: string }[] = []
  const flush = (target?: string) => {
    for (let index = 0; index < pending.length; ) {
      if (target === undefined || pending[index].target === target) out.push(pending.splice(index, 1)[0].line)
      else index += 1
    }
  }
  for (const line of lines) {
    const [, type = '', target = ''] = line.split('|')
    const deferred = deferredTarget(line)
    if (deferred !== null) {
      pending.push({ target: deferred, line })
      continue
    }
    if (ACTION_BOUNDARY.has(type)) flush()
    out.push(line)
    if (type === '-damage') flush(target)
  }
  flush()
  return out
}

/**
 * El simulador decide la Garra Rápida al ordenar el turno y escribe su `-activate` antes de los cambios; en N2/B2 el mensaje
 * sale justo antes de que actúe quien la lleva. Se retrasa hasta el `move` o `cant` de esa posición; si se debilita antes de
 * actuar, no sale (no ha llegado a moverse antes); si no actúa por otra causa, sale antes del final del turno.
 */
const QUICK_CLAW_FLUSH = new Set(['upkeep', 'turn', 'win', 'tie'])

function position(ident: string): string {
  return ident.split(':')[0].trim()
}

export function deferQuickClaw(lines: readonly string[]): string[] {
  const out: string[] = []
  const pending = new Map<string, string>()
  for (const line of lines) {
    const [, type = '', ident = '', effect = ''] = line.split('|')
    if (type === '-activate' && effect.startsWith('item:') && toId(effect.slice(5)) === 'quickclaw') {
      pending.set(position(ident), line)
      continue
    }
    if (pending.size > 0) {
      if (type === 'move' || type === 'cant') {
        const held = pending.get(position(ident))
        if (held !== undefined) {
          out.push(held)
          pending.delete(position(ident))
        }
      } else if (type === 'faint') {
        pending.delete(position(ident))
      } else if (QUICK_CLAW_FLUSH.has(type)) {
        out.push(...pending.values())
        pending.clear()
      }
    }
    out.push(line)
  }
  out.push(...pending.values())
  return out
}

/** Orden de presentación de los mensajes de un update: Garra Rápida (DEC-83) y textos del golpe (DEC-44). */
export function orderBattleMessages(lines: readonly string[]): string[] {
  return deferHitMessages(deferQuickClaw(lines))
}
