import { Generations, Pokemon, Move, Field, calculate } from '@smogon/calc'
import { hiddenPower } from '../core/hiddenPower'
import type { BattleGeneration, BattleSet } from './protocol'

const generations = { 3: Generations.get(3), 5: Generations.get(5) }
type Generation = (typeof generations)[BattleGeneration]

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
  set: BattleSet
  hp?: number
  boosts?: Partial<Record<BoostKey, number>>
  status?: string | null
}

export type DamageField = { weather?: string | null; generation?: BattleGeneration }

export type DamageRange = { min: number; max: number; defenderMaxHp: number }

const BOOST_KEYS: readonly BoostKey[] = ['atk', 'def', 'spa', 'spd', 'spe']

function calcPokemon(side: DamageSide, generation: Generation): Pokemon {
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

function calcMove(moveId: string, generation: Generation, set: BattleSet): Move {
  // El calculador da potencia 70 a las variantes con tipo, aunque el simulador la obtenga de los IV.
  const power = generation.num === 3 && moveId.startsWith('hiddenpower') ? hiddenPower(set.ivs) : undefined
  const id = power && moveId === 'hiddenpower' ? `hiddenpower${power.type.toLowerCase()}` : moveId
  const move = generation.moves.get(id as never)
  if (!move) throw new Error(`Movimiento desconocido para el cálculo de daño: ${moveId}`)
  let basePower = power?.power
  // Potencia fija (DEC-100): el calculador daría 70 a la variante con tipo.
  if (set.hiddenPowerPower !== undefined && moveId.startsWith('hiddenpower')) basePower = set.hiddenPowerPower
  if (set.happiness !== undefined && (moveId === 'return' || moveId === 'frustration')) {
    const happiness = Math.max(0, Math.min(255, set.happiness))
    basePower = Math.max(1, Math.floor((moveId === 'return' ? happiness : 255 - happiness) * 10 / 25))
  }
  const options = basePower !== undefined ? { overrides: { basePower } } : undefined
  return new Move(generation, move.name, options)
}

/** Daño (sin crítico) de `moveId` en PS. Lanza si el cálculo no es posible. */
export function computeDamage(attacker: DamageSide, defender: DamageSide, moveId: string, field: DamageField = {}): DamageRange {
  const generation = generations[field.generation ?? 5]
  const weather = field.weather ? WEATHER_BY_ID[field.weather] : undefined
  const defenderPokemon = calcPokemon(defender, generation)
  const result = calculate(generation, calcPokemon(attacker, generation), defenderPokemon, calcMove(moveId, generation, attacker.set), new Field({ weather }))
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

/** Velocidad efectiva en combate: la del cálculo con sus cambios de característica y, paralizado, la cuarta parte (hasta la 6.ª gen.). */
export function effectiveSpeed(side: DamageSide, field: DamageField = {}): number {
  const generation = generations[field.generation ?? 5]
  const pokemon = calcPokemon({ ...side, boosts: {} }, generation)
  const stage = side.boosts?.spe ?? 0
  const multiplier = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
  return Math.floor(pokemon.rawStats.spe * multiplier * (side.status === 'par' ? 0.25 : 1))
}
