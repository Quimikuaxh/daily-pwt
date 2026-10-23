import pwtRules from './pwt-rules.json'
import { NEUTRAL_NATURE, TEAM_SIZE } from './constants'
import { DataError } from './errors'
import { Prng } from './prng'
import { typeEffectiveness } from './typeChart'
import type { DexData, PokemonSet, ResolvedSet, StatsTable } from './types'

export const MAX_TEAM_ATTEMPTS = 1000
const MIN_DISTINCT_TYPES = 4
/** RF-13b: suma de estadísticas base de los 6 Pokémon. */
export const MIN_BASE_STAT_TOTAL = 2860
/** RF-13c: cada tipo de un Pokémon de doble tipo cuenta. */
export const MAX_POKEMON_PER_TYPE = 2

/** Legendarios prohibidos en el PWT (PRD §6). Lista explícita: los tags de @pkmn vetarían también legendarios legales. Vive en src/core/pwt-rules.json, que también lee scripts/build-player-sets.mjs. */
const FORBIDDEN_SPECIES: readonly string[] = pwtRules.forbiddenSpecies

// Las formas llevan el id base como prefijo (kyuremblack, deoxysattack); 'mew' lo compartiría con Mewtwo, que ya está en la lista.
export function isForbiddenSpecies(speciesId: string): boolean {
  return FORBIDDEN_SPECIES.some((forbidden) => speciesId === forbidden || (forbidden !== 'mew' && speciesId.startsWith(forbidden)))
}

const ZERO_STATS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

function pickDistinctSets(shuffled: readonly PokemonSet[]): PokemonSet[] {
  const chosen: PokemonSet[] = []
  const species = new Set<string>()
  const items = new Set<string>()
  for (const set of shuffled) {
    if (species.has(set.species) || items.has(set.item)) continue
    chosen.push(set)
    species.add(set.species)
    items.add(set.item)
    if (chosen.length === TEAM_SIZE) break
  }
  return chosen
}

function distinctTypeCount(team: readonly PokemonSet[], dex: DexData): number {
  return new Set(team.flatMap((set) => dex.species[set.species].types)).size
}

export function baseStatTotalOf(team: readonly PokemonSet[], dex: DexData): number {
  return team.reduce((total, set) => total + Object.values(dex.species[set.species].baseStats).reduce((sum, stat) => sum + stat, 0), 0)
}

function maxPokemonSharingAType(team: readonly PokemonSet[], dex: DexData): number {
  const countByType = new Map<string, number>()
  for (const set of team) {
    for (const type of dex.species[set.species].types) countByType.set(type, (countByType.get(type) ?? 0) + 1)
  }
  return Math.max(...countByType.values())
}

function hasSuperEffectiveMove(team: readonly PokemonSet[], rivalTeam: readonly ResolvedSet[], dex: DexData): boolean {
  const rivalTypeLists = rivalTeam.map((rival) => dex.species[rival.species]?.types ?? [])
  return team.some((set) =>
    set.moves.some((moveId) => {
      const move = dex.moves[moveId]
      if (!move || move.category === 'Status' || move.basePower <= 0) return false
      return rivalTypeLists.some((types) => typeEffectiveness(move.type, types, dex.typeChart) >= 2)
    }),
  )
}

function resolvePlayerSet(set: PokemonSet, dex: DexData, rng: Prng, ivs: StatsTable): ResolvedSet {
  const resolved: ResolvedSet = {
    species: set.species,
    // Nombre del dex como provisional; getDailyChallenge lo sustituye por el nombre en español.
    nameEs: dex.species[set.species].name,
    level: 50,
    item: set.item,
    ability: rng.pick(set.abilities),
    moves: [...set.moves] as ResolvedSet['moves'],
    nature: set.nature ?? NEUTRAL_NATURE,
    ivs: { ...ivs },
    evs: { ...ZERO_STATS },
  }
  if (set.gender) resolved.gender = set.gender
  return resolved
}

export type PlayerTeamResult = { team: ResolvedSet[]; attempts: number; relaxed: string[] }

/**
 * Elige 6 sets del pool con el PRNG dado (RF-10..16). Cada intento baraja de nuevo el pool con el mismo flujo.
 * Los IV del jugador son los del rival del día (20 contra líderes, 25 contra campeones, 30 contra Rojo; RF-16), EV 0 y naturaleza Seria.
 * Orden de relajación tras MAX_TEAM_ATTEMPTS intentos sin equipo que cumpla todo: primero RF-14 (movimiento ×2); si no hay equipo ni así,
 * también RF-13b (suma de estadísticas base ≥ 2860; `relaxed` es `['RF-13b']` si el equipo sí tiene movimiento ×2, o `['RF-14', 'RF-13b']`). RF-12, RF-13 y RF-13c (máximo 2 Pokémon por tipo)
 * no se relajan nunca: sin solución, error de datos.
 */
export function buildPlayerTeam(pool: readonly PokemonSet[], rivalTeam: readonly ResolvedSet[], rng: Prng, dex: DexData): PlayerTeamResult {
  const candidates = pool.filter((set) => {
    const species = dex.species[set.species]
    return species && !species.nfe && !isForbiddenSpecies(set.species)
  })

  const distinctSpecies = new Set(candidates.map((set) => set.species)).size
  const distinctItems = new Set(candidates.map((set) => set.item)).size
  if (distinctSpecies < TEAM_SIZE || distinctItems < TEAM_SIZE) {
    throw new DataError(
      `El pool del jugador no tiene suficientes Pokémon válidos: hacen falta ${TEAM_SIZE} especies y ${TEAM_SIZE} objetos distintos.`,
    )
  }

  const playerIvs = rivalTeam[0]?.ivs
  if (!playerIvs) throw new DataError('El rival no tiene equipo: no se pueden fijar los IV del jugador.')

  // Primer equipo que cumple todo salvo RF-14 y primer equipo que cumple solo las reglas no relajables (con RF-14 y RF-13b fallando o no).
  let withoutRf14: PokemonSet[] | undefined
  let withoutRf14AndRf13b: PokemonSet[] | undefined
  for (let attempt = 1; attempt <= MAX_TEAM_ATTEMPTS; attempt++) {
    const team = pickDistinctSets(rng.shuffle(candidates))
    if (team.length < TEAM_SIZE || distinctTypeCount(team, dex) < MIN_DISTINCT_TYPES) continue
    if (maxPokemonSharingAType(team, dex) > MAX_POKEMON_PER_TYPE) continue
    if (baseStatTotalOf(team, dex) < MIN_BASE_STAT_TOTAL) {
      withoutRf14AndRf13b ??= team
      continue
    }
    if (hasSuperEffectiveMove(team, rivalTeam, dex)) {
      return { team: team.map((set) => resolvePlayerSet(set, dex, rng, playerIvs)), attempts: attempt, relaxed: [] }
    }
    withoutRf14 ??= team
  }

  if (withoutRf14) {
    return { team: withoutRf14.map((set) => resolvePlayerSet(set, dex, rng, playerIvs)), attempts: MAX_TEAM_ATTEMPTS, relaxed: ['RF-14'] }
  }
  if (withoutRf14AndRf13b) {
    const relaxed = hasSuperEffectiveMove(withoutRf14AndRf13b, rivalTeam, dex) ? ['RF-13b'] : ['RF-14', 'RF-13b']
    return { team: withoutRf14AndRf13b.map((set) => resolvePlayerSet(set, dex, rng, playerIvs)), attempts: MAX_TEAM_ATTEMPTS, relaxed }
  }
  throw new DataError(
    `No se pudo formar un equipo del jugador válido en ${MAX_TEAM_ATTEMPTS} intentos: revisa el pool (mínimo ${MIN_DISTINCT_TYPES} tipos distintos y como máximo ${MAX_POKEMON_PER_TYPE} Pokémon de un mismo tipo).`,
  )
}

export const sourceTagOf = (trainerId: string): string => `source:${trainerId}`

/** Pool provisional sin los sets procedentes del rival del día (RF-11). */
export function poolWithoutRival(pool: readonly PokemonSet[], rivalTrainerId: string): PokemonSet[] {
  const rivalTag = sourceTagOf(rivalTrainerId)
  return pool.filter((set) => !set.tags?.includes(rivalTag))
}
