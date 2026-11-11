import { DataError } from '../errors'
import type { CampaignDefinition } from './campaign'

/** Tipos de gimnasio originales de Esmeralda; la Liga no tiene garantía. */
export const EMERALD_GYM_TYPES: Readonly<Record<string, string>> = {
  petra: 'Rock', marcial: 'Fighting', erico: 'Electric', candela: 'Fire',
  norman: 'Normal', alana: 'Flying', 'vito-y-leti': 'Psychic', galano: 'Water',
}

const attacks: Readonly<Record<string, readonly string[]>> = {
  Rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'], Fighting: ['Flying', 'Psychic'],
  Electric: ['Ground'], Fire: ['Water', 'Ground', 'Rock'], Normal: ['Fighting'],
  Flying: ['Electric', 'Ice', 'Rock'], Psychic: ['Bug', 'Ghost', 'Dark'], Water: ['Electric', 'Grass'],
}

export function gymCounterSpecies(definition: CampaignDefinition, encounterId: string, candidates: readonly string[]): string[] {
  const type = EMERALD_GYM_TYPES[encounterId]
  if (!type) return []
  return candidates.filter(id => {
    const types = definition.species[id]?.types
    if (!types?.length) throw new DataError(`Faltan tipos de tercera generación para ${id}.`)
    return types.some(own => attacks[type].includes(own))
  })
}
