import type { Battle, Pokemon } from '@pkmn/sim'
import type { BattleGeneration, BattleRequest, BattleSet, Choice, RequestMove } from '../protocol'

export type AiMove = { id: string; pp: number; disabled: boolean }

export type AiMon = {
  set: BattleSet
  hp: number
  maxHp: number
  status: string | null
  boosts: Record<string, number>
  fainted: boolean
  moves: AiMove[]
}

export type FoeHazards = { stealthrock?: number; spikes?: number; toxicspikes?: number }

/**
 * Lo que la IA sabe del combate, desde el punto de vista del rival (DEC-12). Tiene información completa del jugador.
 * `self.pokemon[0]` y `foe.pokemon[0]` son los activos; el orden de `self.pokemon` es el de `request.side.pokemon`,
 * así que el slot de un `switch` es la posición + 1.
 */
export type AiState = {
  generation?: BattleGeneration
  turn: number
  weather: string | null
  self: { pokemon: AiMon[]; trapped: boolean; mustSwitch: boolean }
  foe: { pokemon: AiMon[]; hazards?: FoeHazards }
}

export type { Choice }

const RIVAL_SIDE_INDEX = 1
const PLAYER_SIDE_INDEX = 0

function resolveMoveId(moveId: string, pokemon: Pokemon): string {
  return moveId === 'hiddenpower' && pokemon.hpType ? `hiddenpower${pokemon.hpType.toLowerCase()}` : moveId
}

function toBattleSet(pokemon: Pokemon): BattleSet {
  const moves = pokemon.moveSlots.map((slot) => resolveMoveId(slot.id, pokemon))
  const resolved: BattleSet = {
    species: pokemon.species.id,
    nameEs: pokemon.name,
    level: pokemon.level,
    item: pokemon.item,
    ability: pokemon.ability,
    moves,
    nature: pokemon.set.nature,
    ivs: { ...pokemon.set.ivs },
    evs: { ...pokemon.set.evs },
  }
  if (pokemon.set.gender === 'M' || pokemon.set.gender === 'F') resolved.gender = pokemon.set.gender
  if (pokemon.battle.gen === 3 && pokemon.side.id === 'p1') resolved.happiness = pokemon.happiness
  return resolved
}

function toAiMon(pokemon: Pokemon, requestMoves?: RequestMove[]): AiMon {
  const moves: AiMove[] = requestMoves
    ? requestMoves.map((move) => ({ id: resolveMoveId(move.id, pokemon), pp: move.pp ?? 1, disabled: !!move.disabled }))
    : pokemon.moveSlots.map((slot) => ({ id: resolveMoveId(slot.id, pokemon), pp: slot.pp, disabled: !!slot.disabled }))
  return {
    set: toBattleSet(pokemon),
    hp: pokemon.hp,
    maxHp: pokemon.maxhp,
    status: pokemon.status || null,
    boosts: { ...pokemon.boosts },
    fainted: pokemon.hp <= 0,
    moves,
  }
}

function foeHazards(battle: Battle): FoeHazards {
  const conditions = battle.sides[PLAYER_SIDE_INDEX].sideConditions
  const hazards: FoeHazards = {}
  for (const id of ['stealthrock', 'spikes', 'toxicspikes'] as const) {
    const condition = conditions[id]
    if (condition) hazards[id] = condition.layers ?? 1
  }
  return hazards
}

/** Traduce el `Battle` al estado de la IA, desde el punto de vista de p2 (el rival). */
export function buildAiState(battle: Battle): AiState {
  const selfSide = battle.sides[RIVAL_SIDE_INDEX]
  const foeSide = battle.sides[PLAYER_SIDE_INDEX]
  const request = selfSide.activeRequest as BattleRequest | null
  const activeRequestMoves = request?.active?.[0]?.moves

  return {
    generation: battle.gen === 3 ? 3 : 5,
    turn: battle.turn,
    weather: battle.field.weather || null,
    self: {
      pokemon: selfSide.pokemon.map((pokemon, index) => toAiMon(pokemon, index === 0 ? activeRequestMoves : undefined)),
      trapped: !!request?.active?.[0]?.trapped,
      mustSwitch: !!request?.forceSwitch,
    },
    foe: { pokemon: foeSide.pokemon.map((pokemon) => toAiMon(pokemon)), hazards: foeHazards(battle) },
  }
}
