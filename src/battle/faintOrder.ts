import type { BattleView } from './protocol'

const HP_LINE_TYPES = new Set(['-damage', '-sethp'])

const lineTarget = (line: string): string => line.split('|')[2] ?? ''

/**
 * El simulador marca «0 fnt» en el propio golpe, antes del `|faint|`. Si la vista lo recogía tal cual, el sprite empezaba a desvanecerse mientras
 * la barra aún bajaba. Tras aplicar un golpe letal se devuelve la vista con ese Pokémon todavía en pie (con 0 PS): el estado «debilitado» llega con la
 * línea `|faint|`, después de la barra y del mensaje (DEC-42). Si `after` no es de un golpe letal, se devuelve tal cual.
 */
export function deferFaintUntilFaintLine(before: BattleView, after: BattleView, line: string): BattleView {
  if (!HP_LINE_TYPES.has(line.split('|')[1] ?? '')) return after
  const side = /^p1/.test(lineTarget(line)) ? 'player' : 'rival'
  const index = after[side].active
  if (index === null || !after[side].team[index].fainted || before[side].team[index]?.fainted) return after
  const deferred = structuredClone(after)
  deferred[side].team[index].fainted = false
  deferred[side].remaining = before[side].remaining
  return deferred
}
