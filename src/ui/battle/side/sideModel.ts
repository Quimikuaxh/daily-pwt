import { typeEffectiveness } from '../../../core/typeChart'
import type { StatsTable } from '../../../core/types'
import type { Boosts } from '../../../battle/fieldState'
import type { PartyMember, PartyMove } from '../party/partyModel'

/**
 * Paneles laterales del combate (RF-44c, DEC-81): eficacia de un movimiento contra el Pokémon de enfrente y estadísticas con sus subidas y
 * bajadas. Solo lee lo que ya sale en la pantalla de equipo (`partyMembers` / `rivalMembers`) y las subidas y bajadas de la vista.
 */

/** Daño fijo o de un golpe (Sísmico, Tinieblas, Frío Polar…): el tipo solo decide si le afecta, no cuánto. */
const FIXED_DAMAGE = new Set([
  'seismictoss', 'nightshade', 'superfang', 'endeavor', 'psywave', 'finalgambit', 'sonicboom', 'dragonrage', 'counter', 'mirrorcoat',
  'metalburst', 'bide', 'sheercold', 'fissure', 'guillotine', 'horndrill',
])

/** Habilidades del que recibe que anulan un tipo (Gen 5). */
const ABILITY_IMMUNITY: Record<string, string> = {
  levitate: 'Ground',
  flashfire: 'Fire',
  waterabsorb: 'Water',
  dryskin: 'Water',
  stormdrain: 'Water',
  voltabsorb: 'Electric',
  lightningrod: 'Electric',
  motordrive: 'Electric',
  sapsipper: 'Grass',
}

/** Habilidades del atacante que ignoran las del que recibe. */
const IGNORES_ABILITIES = new Set(['moldbreaker', 'teravolt', 'turboblaze'])

type Target = Pick<PartyMember, 'types' | 'abilityId' | 'itemId'>

/**
 * Multiplicador de eficacia del movimiento contra `target` (×0 a ×4), o null si no hace daño. Cuenta las inmunidades de tipo, las de su
 * habilidad (Levitación, Absorbe Fuego, Superguarda…; no con Rompemoldes) y su objeto (Globo, Bola Férrea), y Intrépido del atacante.
 */
export function moveEffectiveness(move: Pick<PartyMove, 'id' | 'typeName' | 'category'>, target: Target, attackerAbilityId: string, chart: Record<string, Record<string, number>>): number | null {
  if (!move.typeName || !move.category || move.category === 'Status') return null
  const types = target.types.map((type) => type.id)
  const ground = move.typeName === 'Ground'
  // Bola Férrea: el Volador deja de ser inmune a Tierra.
  const defending = ground && target.itemId === 'ironball' ? types.filter((type) => type !== 'Flying') : types
  let multiplier = typeEffectiveness(move.typeName, defending, chart)
  // Intrépido: Normal y Lucha alcanzan a los Fantasma.
  if (multiplier === 0 && attackerAbilityId === 'scrappy' && (move.typeName === 'Normal' || move.typeName === 'Fighting') && types.includes('Ghost')) {
    multiplier = typeEffectiveness(move.typeName, types.filter((type) => type !== 'Ghost'), chart)
  }
  if (ground && target.itemId === 'airballoon') multiplier = 0
  if (!IGNORES_ABILITIES.has(attackerAbilityId)) {
    if (ABILITY_IMMUNITY[target.abilityId] === move.typeName && !(ground && target.itemId === 'ironball')) multiplier = 0
    if (target.abilityId === 'wonderguard' && multiplier <= 1) multiplier = 0
  }
  if (FIXED_DAMAGE.has(move.id)) return multiplier === 0 ? 0 : 1
  return multiplier
}

export type EffectivenessTone = 'x4' | 'x2' | 'x1' | 'xh' | 'xq' | 'x0'

export function effectivenessTone(multiplier: number): EffectivenessTone {
  if (multiplier === 0) return 'x0'
  if (multiplier >= 4) return 'x4'
  if (multiplier >= 2) return 'x2'
  if (multiplier <= 0.25) return 'xq'
  if (multiplier < 1) return 'xh'
  return 'x1'
}

export const SIDE_STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const

/**
 * Las seis estadísticas, con su valor original (sin aplicar la subida o bajada; Jose, 05/11/2026) y el nivel de subida o bajada de cada
 * una (0 los PS y las de quien no está en combate).
 */
export function statsWithBoosts(stats: StatsTable, boosts: Boosts | null): { key: keyof StatsTable; value: number; stage: number }[] {
  return SIDE_STAT_KEYS.map((key) => ({ key, value: stats[key], stage: key === 'hp' ? 0 : boosts?.[key] ?? 0 }))
}
