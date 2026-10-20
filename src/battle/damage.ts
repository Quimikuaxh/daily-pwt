import { Generations, Pokemon, Move, Field, calculate } from '@smogon/calc'
import type { ResolvedSet } from '../core/types'

// Siempre Gen 5: los stats y el daño del sim son los de N2/B2 (ARQUITECTURA §2).
const generation = Generations.get(5)

const WEATHER_BY_ID: Record<string, 'Sun' | 'Rain' | 'Sand' | 'Hail'> = {
  sunnyday: 'Sun',
  raindance: 'Rain',
  sandstorm: 'Sand',
  hail: 'Hail',
}

type BoostKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe'
type CalcStatus = 'slp' | 'psn' | 'brn' | 'frz' | 'par' | 'tox'

/** Un lado del cálculo: el set y, opcionalmente, el estado de combate (PS actuales, cambios de característica, estado). */
export type DamageSide = {
  set: ResolvedSet
  hp?: number
  boosts?: Partial<Record<BoostKey, number>>
  status?: string | null
}

export type DamageField = { weather?: string | null }

export type DamageRange = { min: number; max: number; defenderMaxHp: number }

const BOOST_KEYS: readonly BoostKey[] = ['atk', 'def', 'spa', 'spd', 'spe']

function calcPokemon(side: DamageSide): Pokemon {
  const { set } = side
  const species = generation.species.get(set.species as never)
  if (!species) throw new Error(`Especie desconocida para el cálculo de daño: ${set.species}`)

  // @smogon/calc falla con objetos o habilidades que no conoce: se descartan en lugar de abortar el cálculo.
  const itemName = set.item ? generation.items.get(set.item as never)?.name : undefined
  const abilityName = set.ability ? generation.abilities.get(set.ability as never)?.name : undefined
  const boosts: Partial<Record<BoostKey, number>> = {}
  for (const key of BOOST_KEYS) {
    const value = side.boosts?.[key]
    if (value) boosts[key] = value
  }

  return new Pokemon(generation, species.name, {
    level: set.level,
    item: itemName,
    ability: abilityName,
    nature: set.nature,
    ivs: set.ivs,
    evs: set.evs,
    boosts,
    curHP: side.hp,
    status: (side.status || undefined) as CalcStatus | undefined,
  })
}

function calcMove(moveId: string): Move {
  const move = generation.moves.get(moveId as never)
  if (!move) throw new Error(`Movimiento desconocido para el cálculo de daño: ${moveId}`)
  return new Move(generation, move.name)
}

/** Daño (sin crítico) de `moveId` en PS. Lanza si el cálculo no es posible. */
export function computeDamage(attacker: DamageSide, defender: DamageSide, moveId: string, field: DamageField = {}): DamageRange {
  const weather = field.weather ? WEATHER_BY_ID[field.weather] : undefined
  const defenderPokemon = calcPokemon(defender)
  const result = calculate(generation, calcPokemon(attacker), defenderPokemon, calcMove(moveId), new Field({ weather }))
  const [min, max] = result.range()
  return { min, max, defenderMaxHp: defenderPokemon.maxHP() }
}

/** Como `computeDamage`, pero un cálculo imposible cuenta como daño nulo (la IA no debe caer por un dato raro). */
export function damageOrZero(attacker: DamageSide, defender: DamageSide, moveId: string, field: DamageField = {}): DamageRange {
  try {
    return computeDamage(attacker, defender, moveId, field)
  } catch {
    return { min: 0, max: 0, defenderMaxHp: Math.max(1, defender.hp ?? 1) }
  }
}
