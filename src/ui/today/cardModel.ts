import { hiddenPowerPowerOf, resolveHiddenPowerId } from '../../core/hiddenPower'
import { calcStats } from '../../core/stats'
import type { DexMove, GameData, ResolvedSet, StatsTable } from '../../core/types'
import { es } from '../../i18n/es'

const NOT_APPLICABLE = es.today.notApplicable

export type MoveModel = {
  id: string
  name: string
  typeName: string | null
  typeLabel: string | null
  category: DexMove['category'] | null
  categoryLabel: string | null
  power: string
  accuracy: string
  maxPp: number | null
}

export type CardModel = {
  nameEs: string
  speciesId: string
  types: { id: string; label: string }[]
  itemId: string
  itemName: string
  abilityId: string
  abilityName: string
  baseStatTotal: number
  stats: StatsTable
  moves: MoveModel[]
}

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const

/**
 * Con los IV del Pokémon, Poder Oculto se muestra con su tipo (icono y color) y su potencia reales; el nombre es solo «Poder Oculto», sin el
 * tipo (decisión de Jose, 28/10/2026). `id` sigue siendo el del set.
 */
export function moveModel(moveId: string, data: GameData, ivs?: StatsTable, hiddenPowerPower?: number): MoveModel {
  const shownId = resolveHiddenPowerId(moveId, ivs)
  const move = data.dex.moves[shownId]
  const name = data.names.moves[moveId] ?? data.names.moves[shownId] ?? es.battle.unknownMove
  if (!move) return { id: moveId, name, typeName: null, typeLabel: null, category: null, categoryLabel: null, power: NOT_APPLICABLE, accuracy: NOT_APPLICABLE, maxPp: null }
  const pp = data.dex.moves[moveId]?.pp
  return {
    id: moveId,
    name,
    typeName: move.type,
    typeLabel: data.names.types[move.type] ?? move.type,
    category: move.category,
    categoryLabel: es.today.categoryNames[move.category],
    power: shownId !== moveId && ivs ? String(hiddenPowerPowerOf({ ivs, hiddenPowerPower })) : move.basePower > 0 ? String(move.basePower) : NOT_APPLICABLE,
    accuracy: typeof move.accuracy === 'number' ? String(move.accuracy) : NOT_APPLICABLE,
    maxPp: pp === undefined ? null : Math.floor((pp * 8) / 5),
  }
}

export const itemName = (set: ResolvedSet, data: GameData): string => data.names.items[set.item] ?? es.log.unknownItem
export const abilityName = (set: ResolvedSet, data: GameData): string => data.names.abilities[set.ability] ?? es.log.unknownAbility

export function cardModel(set: ResolvedSet, data: GameData): CardModel {
  const species = data.dex.species[set.species]
  return {
    nameEs: set.nameEs,
    speciesId: set.species,
    types: species.types.map((typeName) => ({ id: typeName, label: data.names.types[typeName] ?? typeName })),
    itemId: set.item,
    itemName: itemName(set, data),
    abilityId: set.ability,
    abilityName: abilityName(set, data),
    baseStatTotal: STAT_KEYS.reduce((total, key) => total + species.baseStats[key], 0),
    stats: calcStats(species.baseStats, set.ivs, set.evs, set.nature, set.level),
    moves: set.moves.map((moveId) => moveModel(moveId, data, set.ivs, set.hiddenPowerPower)),
  }
}
