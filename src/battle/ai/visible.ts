import { Dex, type Battle, type Pokemon } from '@pkmn/sim'
import { buildAiState, type AiMon, type AiState } from './state'

/**
 * Lo que el rival sabe del jugador (Nuzlocke de Hoenn, Alto Mando y campeón; Jose, 12/11/2026). Conoce su equipo entero, banquillo
 * incluido, con sus PS y cambios; no sabe sus movimientos exactos ni su objeto (la habilidad, la de la especie). De cada Pokémon cuenta
 * con los movimientos que le ha visto usar y, mientras no los conozca todos, predice los posibles: de los que puede llevar según las
 * reglas de la campaña (`EngineInit.foeMovePool`), el ataque más fuerte de cada tipo. Sin esa lista, un ataque básico de cada tipo suyo
 * (`BASIC_ATTACKS`). El nivel y las estadísticas salen de las reglas de la campaña (20 IV, sin EV, naturaleza neutra), que son públicas.
 */

/** Un ataque de unos 60 de potencia de cada tipo en Esmeralda: lo que se supone que tiene un Pokémon del que aún no se ha visto nada. */
export const BASIC_ATTACKS: Readonly<Record<string, string>> = {
  Normal: 'headbutt', Fire: 'flamewheel', Water: 'bubblebeam', Electric: 'shockwave', Grass: 'magicalleaf', Ice: 'aurorabeam',
  Fighting: 'brickbreak', Poison: 'sludge', Ground: 'mudshot', Flying: 'wingattack', Psychic: 'psybeam', Bug: 'silverwind',
  Rock: 'ancientpower', Ghost: 'shadowpunch', Dragon: 'dragonbreath', Dark: 'bite', Steel: 'steelwing',
}

/** De los movimientos posibles, el ataque más fuerte (potencia por precisión) de cada tipo que no se le haya visto ya. */
function predicted(pool: readonly string[], known: readonly string[], generation: 3 | 5): string[] {
  const dex = Dex.forGen(generation)
  const knownTypes = new Set(known.map((id) => dex.moves.get(id).type))
  const best = new Map<string, { id: string; power: number }>()
  for (const id of pool) {
    const move = dex.moves.get(id)
    if (!move.exists || move.category === 'Status' || !move.basePower || known.includes(move.id) || knownTypes.has(move.type)) continue
    const power = move.basePower * (move.accuracy === true ? 1 : move.accuracy / 100)
    if ((best.get(move.type)?.power ?? -1) < power) best.set(move.type, { id: move.id, power })
  }
  return [...best.values()].map((entry) => entry.id)
}

function visibleMon(mon: AiMon, pokemon: Pokemon, pool: readonly string[] | undefined, generation: 3 | 5): AiMon {
  const used: string[] = pokemon.moveSlots.filter((slot) => slot.used).map((slot) => slot.id)
  const seenMoves = mon.moves.filter((move) => used.includes(move.id.replace(/^hiddenpower.+/, 'hiddenpower')))
  const guesses = used.length >= 4 ? [] : pool
    ? predicted(pool, used, generation)
    : used.length ? [] : pokemon.species.types.map((type) => BASIC_ATTACKS[type]).filter(Boolean)
  const moves = [...seenMoves, ...guesses.map((id) => ({ id, pp: 1, disabled: false }))]
  return {
    ...mon,
    set: { ...mon.set, item: '', ability: pokemon.species.abilities[0] ? pokemon.species.abilities[0].toLowerCase().replace(/[^a-z0-9]/g, '') : mon.set.ability, moves: moves.map((move) => move.id) },
    moves,
  }
}

/**
 * Lo que amenaza al activo del rival aunque no le peguen (para decidir si le conviene cambiar): turnos que le quedan de Canto Mortal,
 * cuánto ha avanzado Tóxico, si tiene Drenadoras y si está atado a un movimiento (Otra Vez, Anulación, Tormento, Mofa u objeto Elección).
 */
export type ActiveDanger = { perish: number | null; toxicStage: number; leechSeed: boolean; locked: boolean }
/** `foeLastMove`: el último ataque que ha usado el Pokémon del jugador en el campo (se ve en el combate). */
export type LookaheadState = AiState & { danger: ActiveDanger; foeLastMove?: string | null; justIn?: boolean }

function dangerOf(pokemon: Pokemon | undefined): ActiveDanger {
  const volatiles = (pokemon?.volatiles ?? {}) as Record<string, { duration?: number } | undefined>
  return {
    perish: volatiles.perishsong?.duration ?? null,
    toxicStage: pokemon?.status === 'tox' ? Number((pokemon.statusState as { stage?: number }).stage ?? 0) : 0,
    leechSeed: !!volatiles.leechseed,
    locked: ['encore', 'disable', 'torment', 'taunt', 'choicelock'].some((id) => !!volatiles[id]),
  }
}

/** Estado de la IA sin los movimientos exactos ni los objetos del jugador (`pools`: lo que cada especie suya puede llevar). */
export function buildVisibleAiState(battle: Battle, pools?: Readonly<Record<string, readonly string[]>>): LookaheadState {
  const full = buildAiState(battle)
  const foe = battle.sides[0].pokemon
  const generation = full.generation ?? 5
  return {
    ...full,
    foe: { ...full.foe, pokemon: full.foe.pokemon.map((mon, i) => visibleMon(mon, foe[i], pools?.[foe[i].species.id], generation)) },
    danger: dangerOf(battle.sides[1].pokemon[0]),
    foeLastMove: battle.sides[0].active[0]?.lastMove?.id ?? null,
    // Recién entrado (no ha actuado aún en el campo): sin esto, contra quien le gana a todos, cambiaba cada turno.
    justIn: (battle.sides[1].active[0]?.activeTurns ?? 0) <= 1,
  }
}
