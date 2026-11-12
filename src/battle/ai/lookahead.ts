import { Dex } from '@pkmn/sim'
import type { Prng } from '../../core/prng'
import { damageOrZero, effectiveSpeed, type DamageField, type DamageSide } from '../damage'
import { chooseRivalAction } from './heuristic'
import { moveInfo, type MoveInfo } from './moveInfo'
import type { AiMon, AiState, Choice } from './state'

/**
 * IA que mira un turno por delante (opción 2 de PENDIENTE, elegida por Jose el 12/11/2026 para el Alto Mando y el campeón de la
 * Nuzlocke): cada opción del rival (sus ataques con PP y cambiar a cada uno de su banquillo) contra cada respuesta posible del jugador
 * (los ataques que le ha visto, `buildVisibleAiState`), no la elegida; se queda con la de mejor resultado frente a la mejor respuesta
 * del jugador (minimax de un turno). El resultado de un turno es la fracción de PS que quita menos la que pierde, con el orden de
 * velocidad y prioridad, el KO que impide actuar al otro y un plus por cada KO. Los movimientos de estado y los cambios forzados siguen
 * las reglas de la heurística (`chooseRivalAction`), que ya sabe cuándo aplican; esta IA solo cambia cuál de los ataques usa o si cambia.
 */

const KO_BONUS = 0.5
/** Cambiar cuesta el turno: sin esto, cambiaría por cualquier diferencia mínima. */
const SWITCH_COST = 0.1

const side = (mon: AiMon): DamageSide => ({ set: mon.set, hp: mon.hp, boosts: mon.boosts, status: mon.status })
const priority = (moveId: string, field: DamageField) => Dex.forGen(field.generation ?? 5).moves.get(moveId).priority ?? 0
const usable = (mon: AiMon) => mon.moves.map((move, index) => ({ move, slot: index + 1 })).filter(({ move }) => !move.disabled && move.pp > 0)

/** Daño esperado de un ataque (media del intervalo por la precisión; los de dos turnos, a la mitad). */
function expected(attacker: AiMon, defender: AiMon, moveId: string, info: MoveInfo, field: DamageField): number {
  const range = damageOrZero(side(attacker), side(defender), moveId, field)
  return (((range.min + range.max) / 2) * info.accuracy) / (info.twoTurn || info.recharge ? 2 : 1)
}

type Action = { kind: 'move'; moveId: string; info: MoveInfo } | { kind: 'switch'; mon: AiMon }

/** Un turno entre `me` (o el que entra al cambiar) y `foe`: fracción de PS que quita el rival menos la que pierde, con plus por KO. */
export function turnScore(me: AiMon, mine: Action, foe: AiMon, foeMove: string | null, field: DamageField): number {
  const target = mine.kind === 'switch' ? mine.mon : me
  const foeInfo = foeMove ? moveInfo(foeMove, field.generation) : null
  const incoming = foeMove && foeInfo?.kind === 'attack' ? Math.min(target.hp, expected(foe, target, foeMove, foeInfo, field)) : 0
  if (mine.kind === 'switch') return -incoming / Math.max(1, target.hp) - (incoming >= target.hp ? KO_BONUS : 0) - SWITCH_COST
  const outgoing = mine.info.kind === 'attack' ? Math.min(foe.hp, expected(me, foe, mine.moveId, mine.info, field)) : 0
  // Quién actúa primero: prioridad y, a igualdad, velocidad (un empate cuenta como que el rival va segundo, lo prudente).
  const myPriority = priority(mine.moveId, field)
  const foePriority = foeMove ? priority(foeMove, field) : 0
  const mineFirst = myPriority !== foePriority ? myPriority > foePriority : effectiveSpeed(side(me), field) > effectiveSpeed(side(foe), field)
  const iKo = outgoing >= foe.hp
  const theyKo = incoming >= me.hp
  const dealt = mineFirst || !theyKo ? outgoing : 0
  const taken = !mineFirst || !iKo ? incoming : 0
  return dealt / Math.max(1, foe.hp) - taken / Math.max(1, me.hp) + (dealt >= foe.hp ? KO_BONUS : 0) - (taken >= me.hp ? KO_BONUS : 0)
}

export function chooseLookaheadAction(state: AiState, rng: Prng): Choice {
  const base = chooseRivalAction(state, rng)
  if (state.self.mustSwitch) return base
  const me = state.self.pokemon[0]
  const foe = state.foe.pokemon.find((mon) => !mon.fainted) ?? state.foe.pokemon[0]
  if (!foe) return base
  const field: DamageField = { weather: state.weather, generation: state.generation }
  // Si la heurística elige un movimiento de estado, curación o mejora, se respeta: esta IA decide entre atacar y cambiar.
  if (base.type === 'move') {
    const chosen = me.moves[base.slot - 1]
    if (chosen && moveInfo(chosen.id, field.generation).kind !== 'attack') return base
  }
  const options: { choice: Choice; action: Action }[] = usable(me)
    .map(({ move, slot }) => ({ choice: { type: 'move', slot } as Choice, action: { kind: 'move', moveId: move.id, info: moveInfo(move.id, field.generation) } as Action }))
    .filter(({ action }) => action.kind === 'move' && action.info.kind === 'attack' && !action.info.unreliable)
  if (!state.self.trapped) {
    state.self.pokemon.forEach((mon, index) => {
      if (index > 0 && !mon.fainted) options.push({ choice: { type: 'switch', slot: index + 1 }, action: { kind: 'switch', mon } })
    })
  }
  if (!options.length) return base
  const responses: (string | null)[] = foe.moves.filter((move) => moveInfo(move.id, field.generation).kind === 'attack').map((move) => move.id)
  if (!responses.length) responses.push(null)
  const worst = options.map(({ action }) => Math.min(...responses.map((response) => turnScore(me, action, foe, response, field))))
  const top = Math.max(...worst)
  return rng.pick(options.filter((_, i) => Math.abs(worst[i] - top) < 1e-9)).choice
}
