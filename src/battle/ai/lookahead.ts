import { Dex } from '@pkmn/sim'
import type { Prng } from '../../core/prng'
import { damageOrZero, effectiveSpeed, type DamageField, type DamageSide } from '../damage'
import { chooseRivalAction } from './heuristic'
import { moveInfo, type MoveInfo } from './moveInfo'
import type { AiMon, AiState, Choice } from './state'
import type { ActiveDanger } from './visible'

/**
 * IA que mira un turno por delante (opción 2 de PENDIENTE, elegida por Jose el 12/11/2026 para el Alto Mando y el campeón de la
 * Nuzlocke). Cada opción del rival (sus ataques con PP y cambiar a cada uno de su banquillo) contra cada respuesta posible del jugador
 * (los ataques que le ha visto y los que predice, `buildVisibleAiState`), no la elegida; se queda con la de mejor resultado frente a la
 * mejor respuesta del jugador (minimax de un turno).
 *
 * El resultado de un turno es la fracción de PS que quita menos la que pierde, con el orden de velocidad y prioridad, el KO que impide
 * actuar al otro y un plus por cada KO, más cómo queda en el campo para el turno siguiente (`FUTURE_WEIGHT`): así cambia cuando lo que
 * tiene no hace casi nada y otro de su equipo planta cara (Jose, 12/11/2026). El daño que recibe cada uno pesa según lo importante que
 * es (`importance`): no mete a uno clave a recibir por salvar a otro que hace menos falta, y uno prescindible puede quedarse a aguantar.
 *
 * Cambia también, aunque la heurística quiera otra cosa, si está atado a algo inútil (Otra Vez, Anulación, Tormento, Mofa u objeto
 * Elección con un movimiento que apenas hace daño) o si algo le va a debilitar sin remedio (Canto Mortal a punto de acabar, Tóxico
 * avanzado o Drenadoras con poca vida). Fuera de eso, los movimientos de estado, mejoras, curaciones y cambios forzados siguen la
 * heurística (`chooseRivalAction`), que ya sabe cuándo aplican.
 */

const KO_BONUS = 0.5
/** Cambiar cuesta el turno: sin esto, cambiaría por cualquier diferencia mínima. */
const SWITCH_COST = 0.15
/** Peso de cómo queda el que está en el campo para el turno siguiente. */
const FUTURE_WEIGHT = 0.5
/** Por debajo de esta fracción de los PS del jugador, un ataque «no hace casi nada». */
const USELESS_FRACTION = 0.1
/**
 * Contra un Pokémon que repite ataque (Cinta Elegida, o simplemente el que más le conviene) el peor caso de todos los ataques posibles
 * hacía que cada cambio pareciera mejor que quedarse y la IA cambiaba sin parar (Jose, 12/11/2026, Tauros contra Sixto). Ahora la
 * puntuación mezcla el peor caso con el ataque que acaba de usar (`LAST_MOVE_WEIGHT`), y un cambio solo gana si supera al mejor
 * ataque por `SWITCH_MARGIN`, salvo que esté atado o en peligro (`stuck`).
 */
const LAST_MOVE_WEIGHT = 0.5
/**
 * Un cambio voluntario tiene que suponer una diferencia MUY sustancial (Jose, 13/11/2026), con tres condiciones a la vez, salvo que esté
 * atado o en peligro (`stuck`):
 * - superar al mejor ataque por `SWITCH_MARGIN`;
 * - que quien entra no reciba `MAX_SWITCH_HIT` de sus PS o más con la respuesta del jugador (el peor de sus ataques, o el último que
 *   usó si lo repite): un golpe muy alto al entrar no compensa;
 * - que, tras ese golpe, gane con claridad al Pokémon del jugador el turno siguiente (`MIN_SWITCH_EDGE` de `matchup`): el beneficio
 *   tiene que durar, no ser un poco menos malo. Si quedarse es caer sin actuar (el jugador va antes y le debilita), basta con que quien
 *   entra no pierda (`matchup` ≥ 0): salvarlo ya es el beneficio.
 * Se quitó la excepción de «apenas hace daño» (menos del 30 % de los PS, sin margen), que sacaba, p. ej., a un Dusclops inmune a los
 * ataques de un Machamp para meter a un Banette frágil. Descartado subir el margen a 0,5: ni con el del campo sin hacer nada y otro
 * que gana de calle llegaba (la ganancia típica de un cambio claro es 0,2-0,3).
 */
const SWITCH_MARGIN = 0.2
const MAX_SWITCH_HIT = 0.4
const MIN_SWITCH_EDGE = 0.5
/*
 * Sin hacer nada (Jose, 14/11/2026: el Shiftry de Sixto usaba Paranormal contra un Umbreon, inmune, en vez de cambiar o usar otro
 * movimiento). Un ataque de daño que no le hace nada al del jugador no se usa nunca. Si sus ataques de daño no le quitan ni
 * `USELESS_FRACTION` de sus PS (los de estado no cuentan), cambia sin pedir la mejora grande: basta con que quien entra no reciba
 * `MAX_SWITCH_HIT` o más, no pierda el cara a cara (`matchup` ≥ 0) y sí le haga daño (si no, cambiarían uno por otro sin fin). Si
 * ninguno vale, usa un movimiento de estado o de mejora (la heurística, sin los ataques que no hacen nada) y, si no tiene, el ataque
 * que más haga. Solo con algún ataque de daño: uno que solo lleva movimientos de estado no está «sin hacer nada».
 */

const side = (mon: AiMon): DamageSide => ({ set: mon.set, hp: mon.hp, boosts: mon.boosts, status: mon.status })
const priority = (moveId: string, field: DamageField) => Dex.forGen(field.generation ?? 5).moves.get(moveId).priority ?? 0
const usable = (mon: AiMon) => mon.moves.map((move, index) => ({ move, slot: index + 1 })).filter(({ move }) => !move.disabled && move.pp > 0)
const attacksOf = (mon: AiMon, field: DamageField) => mon.moves.filter((move) => moveInfo(move.id, field.generation).kind === 'attack')
/** Ataque de daño que no le quita nada a `foe` (inmunidad, Levitación…). */
const noDamage = (me: AiMon, foe: AiMon, moveId: string, field: DamageField) => {
  const info = moveInfo(moveId, field.generation)
  return info.kind === 'attack' && expected(me, foe, moveId, info, field) <= 0
}

/** Daño esperado de un ataque (media del intervalo por la precisión; los de dos turnos, a la mitad). */
function expected(attacker: AiMon, defender: AiMon, moveId: string, info: MoveInfo, field: DamageField): number {
  const range = damageOrZero(side(attacker), side(defender), moveId, field)
  return (((range.min + range.max) / 2) * info.accuracy) / (info.twoTurn || info.recharge ? 2 : 1)
}

function bestHit(attacker: AiMon, defender: AiMon, field: DamageField, onlyUsable = false): number {
  const moves = onlyUsable ? usable(attacker).map(({ move }) => move) : attacker.moves
  let best = 0
  for (const move of moves) {
    const info = moveInfo(move.id, field.generation)
    if (info.kind === 'attack') best = Math.max(best, expected(attacker, defender, move.id, info, field))
  }
  return best
}

/**
 * Ventaja de `mon` (con `hp`) sobre `foe` para el turno siguiente: fracción de PS que le quitaría menos la que perdería, con el orden de
 * velocidad (Jose, 13/11/2026): el más lento que cae de un golpe no llega a pegar, y el más rápido que debilita no recibe nada.
 */
function matchup(mon: AiMon, hp: number, foe: AiMon, field: DamageField): number {
  if (hp <= 0) return -1
  const at = { ...mon, hp }
  const out = bestHit(at, foe, field)
  const inc = bestHit(foe, at, field)
  const first = effectiveSpeed(side(at), field) > effectiveSpeed(side(foe), field)
  const dealt = first || inc < hp ? out : 0
  const taken = !first || out < foe.hp ? inc : 0
  return Math.min(1, dealt / Math.max(1, foe.hp)) - Math.min(1, taken / hp)
}

/**
 * Lo importante que es cada Pokémon del rival, de 0,5 a 1,5: sube con lo bien que planta cara a los Pokémon del jugador que quedan
 * (con los PS de cada uno ahora), y más si es el único de su equipo que le gana a alguno de ellos. Una tabla de ventajas por pareja.
 */
export function importance(team: readonly AiMon[], foes: readonly AiMon[], field: DamageField): Map<AiMon, number> {
  const alive = foes.filter((foe) => !foe.fainted)
  const edge = team.map((mon) => alive.map((foe) => (mon.fainted ? -1 : matchup(mon, mon.hp, foe, field))))
  return new Map(team.map((mon, i) => {
    if (!alive.length || mon.fainted) return [mon, 0.5]
    let value = 0
    alive.forEach((_, j) => {
      if (edge[i][j] <= 0) return
      value += edge[i][j]
      if (!team.some((_, k) => k !== i && edge[k][j] > 0)) value += 0.5
    })
    return [mon, Math.min(1.5, 0.5 + value / alive.length)]
  }))
}

type Action = { kind: 'move'; moveId: string; info: MoveInfo } | { kind: 'switch'; mon: AiMon }

/** Un turno entre `me` (o el que entra al cambiar) y `foe`, con el peso de cada uno y cómo queda el del campo para el siguiente. */
export function turnScore(me: AiMon, mine: Action, foe: AiMon, foeMove: string | null, field: DamageField, weight: (mon: AiMon) => number = () => 1): number {
  const target = mine.kind === 'switch' ? mine.mon : me
  const foeInfo = foeMove ? moveInfo(foeMove, field.generation) : null
  const incoming = foeMove && foeInfo?.kind === 'attack' ? Math.min(target.hp, expected(foe, target, foeMove, foeInfo, field)) : 0
  const w = weight(target)
  if (mine.kind === 'switch') {
    const loss = (incoming / Math.max(1, target.hp)) * w + (incoming >= target.hp ? KO_BONUS * w : 0)
    return -loss - SWITCH_COST + FUTURE_WEIGHT * matchup(target, target.hp - incoming, foe, field)
  }
  const outgoing = mine.info.kind === 'attack' ? Math.min(foe.hp, expected(me, foe, mine.moveId, mine.info, field)) : 0
  // Quién actúa primero: prioridad y, a igualdad, velocidad (un empate cuenta como que el rival va segundo, lo prudente).
  const myPriority = priority(mine.moveId, field)
  const foePriority = foeMove ? priority(foeMove, field) : 0
  const mineFirst = myPriority !== foePriority ? myPriority > foePriority : effectiveSpeed(side(me), field) > effectiveSpeed(side(foe), field)
  const iKo = outgoing >= foe.hp
  const theyKo = incoming >= me.hp
  const dealt = mineFirst || !theyKo ? outgoing : 0
  const taken = !mineFirst || !iKo ? incoming : 0
  const now = dealt / Math.max(1, foe.hp) + (dealt >= foe.hp ? KO_BONUS : 0) - (taken / Math.max(1, me.hp)) * w - (taken >= me.hp ? KO_BONUS * w : 0)
  return now + (dealt >= foe.hp ? 0 : FUTURE_WEIGHT * matchup(me, me.hp - taken, { ...foe, hp: foe.hp - dealt }, field))
}

/** Algo le va a debilitar o le tiene atado a nada útil: mejor cambiar si puede. */
function stuck(me: AiMon, foe: AiMon, danger: ActiveDanger | undefined, field: DamageField): boolean {
  if (!danger) return false
  if (danger.perish !== null && danger.perish <= 1) return true
  if (danger.toxicStage >= 3 && me.hp < me.maxHp / 2) return true
  if (danger.leechSeed && me.hp < me.maxHp * 0.4) return true
  if (!danger.locked) return false
  // Atado: si lo que puede usar no hace casi nada (o es un movimiento de estado), no le sirve quedarse.
  return bestHit(me, foe, field, true) < foe.hp * USELESS_FRACTION
}

export function chooseLookaheadAction(state: AiState & { danger?: ActiveDanger; foeLastMove?: string | null; justIn?: boolean }, rng: Prng): Choice {
  const base = chooseRivalAction(state, rng)
  if (state.self.mustSwitch) return base
  const me = state.self.pokemon[0]
  const foe = state.foe.pokemon.find((mon) => !mon.fainted) ?? state.foe.pokemon[0]
  if (!foe) return base
  const field: DamageField = { weather: state.weather, generation: state.generation }
  const bench = state.self.trapped ? [] : state.self.pokemon.map((mon, index) => ({ mon, slot: index + 1 })).filter(({ mon }, index) => index > 0 && !mon.fainted)
  const isStuck = bench.length > 0 && stuck(me, foe, state.danger, field)
  const responses: (string | null)[] = attacksOf(foe, field).map((move) => move.id)
  if (!responses.length) responses.push(null)
  const last = state.foeLastMove && responses.includes(state.foeLastMove) ? state.foeLastMove : null
  const hitOnEntry = (mon: AiMon) => {
    const hits = (last ? [last] : responses).map((response) => {
      const info = response ? moveInfo(response, field.generation) : null
      return response && info?.kind === 'attack' ? expected(foe, mon, response, info, field) : 0
    })
    return Math.max(0, ...hits) / Math.max(1, mon.hp)
  }
  const weights = importance(state.self.pokemon, state.foe.pokemon, field)
  const weight = (mon: AiMon) => weights.get(mon) ?? 1
  const score = (action: Action) => {
    const worst = Math.min(...responses.map((response) => turnScore(me, action, foe, response, field, weight)))
    return last ? (1 - LAST_MOVE_WEIGHT) * worst + LAST_MOVE_WEIGHT * turnScore(me, action, foe, last, field, weight) : worst
  }
  const hasAttacks = usable(me).some(({ move }) => moveInfo(move.id, field.generation).kind === 'attack')
  if (!isStuck && hasAttacks && bestHit(me, foe, field, true) < foe.hp * USELESS_FRACTION) {
    const entrants = bench.filter(({ mon }) => {
      const hit = hitOnEntry(mon)
      return hit < MAX_SWITCH_HIT && matchup(mon, mon.hp * (1 - hit), foe, field) >= 0 && bestHit(mon, foe, field) >= foe.hp * USELESS_FRACTION
    }).map(({ mon, slot }) => ({ slot, value: score({ kind: 'switch', mon }) }))
    if (entrants.length) {
      const top = Math.max(...entrants.map((entrant) => entrant.value))
      return { type: 'switch', slot: rng.pick(entrants.filter((entrant) => Math.abs(entrant.value - top) < 1e-9)).slot }
    }
    const useful = { ...me, moves: me.moves.map((move) => (noDamage(me, foe, move.id, field) ? { ...move, disabled: true } : move)) }
    if (useful.moves.some((move) => !move.disabled && move.pp > 0)) {
      const fallback = chooseRivalAction({ ...state, self: { ...state.self, pokemon: [useful, ...state.self.pokemon.slice(1)] } }, rng)
      if (fallback.type === 'move' && !useful.moves[fallback.slot - 1]?.disabled) return fallback
    }
    // Sin estado ni mejora útiles: sigue abajo, entre los ataques que sí hacen algo y los cambios de siempre.
  }
  // Si la heurística elige un movimiento de estado, curación o mejora y no está atada, se respeta: esta IA decide entre atacar y cambiar.
  if (!isStuck && base.type === 'move') {
    const chosen = me.moves[base.slot - 1]
    if (chosen && moveInfo(chosen.id, field.generation).kind !== 'attack') return base
  }
  const options: { choice: Choice; action: Action }[] = isStuck ? [] : usable(me)
    .map(({ move, slot }) => ({ choice: { type: 'move', slot } as Choice, action: { kind: 'move', moveId: move.id, info: moveInfo(move.id, field.generation) } as Action }))
    .filter(({ action }) => action.kind === 'move' && action.info.kind === 'attack' && !action.info.unreliable && !noDamage(me, foe, action.moveId, field))
  // Recién entrado, no vuelve a cambiar salvo que esté atado o en peligro: cada cambio regala un golpe (Jose, 12/11/2026, Sixto).
  if (!state.justIn || isStuck) for (const { mon, slot } of bench) options.push({ choice: { type: 'switch', slot }, action: { kind: 'switch', mon } })
  if (!options.length) return base
  const scores = options.map(({ action }) => score(action))
  const foeFirst = effectiveSpeed(side(foe), field) >= effectiveSpeed(side(me), field)
  const doomed = foeFirst && (last ? [last] : responses).some((response) => {
    const info = response ? moveInfo(response, field.generation) : null
    return !!response && info?.kind === 'attack' && expected(foe, me, response, info, field) >= me.hp
  })
  const adjusted = scores.map((score, i) => {
    const action = options[i].action
    // Las condiciones del cambio valen también sin ningún ataque útil (todos sin daño): sin ellas metía a quien recibe un golpe muy alto.
    if (action.kind !== 'switch' || isStuck) return score
    const hit = hitOnEntry(action.mon)
    if (hit >= MAX_SWITCH_HIT || matchup(action.mon, action.mon.hp * (1 - hit), foe, field) < (doomed ? 0 : MIN_SWITCH_EDGE)) return -Infinity
    return score - SWITCH_MARGIN
  })
  const top = Math.max(...adjusted)
  // Nada que valga (solo ataques sin daño y ningún cambio aceptable): lo que diga la heurística, sin cambiar.
  if (!Number.isFinite(top)) return base.type === 'move' ? base : { type: 'move', slot: usable(me)[0]?.slot ?? 1 }
  return rng.pick(options.filter((_, i) => Math.abs(adjusted[i] - top) < 1e-9)).choice
}
