import { DataError } from '../errors'
import type { CampaignDefinition } from './campaign'
import { campaignRules, rulesOf } from './rules'

/** Tipos de gimnasio originales de Esmeralda; la Liga no tiene garantía. Los de cada campaña están en sus reglas (`rules.ts`). */
export const EMERALD_GYM_TYPES: Readonly<Record<string, string>> = campaignRules('hoenn-emerald').gymTypes

/** Tipos supereficaces contra cada tipo de gimnasio (los de Hoenn y Teselia). */
const attacks: Readonly<Record<string, readonly string[]>> = {
  Rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'], Fighting: ['Flying', 'Psychic'],
  Electric: ['Ground'], Fire: ['Water', 'Ground', 'Rock'], Normal: ['Fighting'],
  Flying: ['Electric', 'Ice', 'Rock'], Psychic: ['Bug', 'Ghost', 'Dark'], Water: ['Electric', 'Grass'],
  Poison: ['Ground', 'Psychic'], Bug: ['Fire', 'Flying', 'Rock'], Ground: ['Water', 'Grass', 'Ice'], Dragon: ['Ice', 'Dragon'],
}

export function gymCounterSpecies(definition: CampaignDefinition, encounterId: string, candidates: readonly string[]): string[] {
  const type = rulesOf(definition)?.gymTypes[encounterId]
  if (!type) return []
  return candidates.filter(id => {
    const types = definition.species[id]?.types
    if (!types?.length) throw new DataError(`Faltan los tipos de ${id}.`)
    return types.some(own => attacks[type].includes(own))
  })
}
