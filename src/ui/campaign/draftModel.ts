/**
 * Datos de un candidato del draft para la pantalla (D7): nombre, número, tipos, suma base, estadísticas al nivel del hito (20 IV, 0 EV y
 * naturaleza neutra, PRD §0 «Estadísticas de combate de Hoenn»), habilidad y evolución por nivel.
 */
import type { CampaignDefinition } from '../../core/nuzlocke/campaign'
import type { GameData } from '../../core/types'
import emeraldSprites from '../../generated/emerald/sprites.json'
import { esCampaign } from '../../i18n/esCampaign'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import { emeraldAbilityName } from './emeraldNames'
import type { BitmapFont } from '../console/theme'

export type Candidate = {
  id: string
  name: string
  dex: number
  types: string[]
  typeNames: string[]
  total: number
  stats: number[]
  ability: string
  evolution: { target: string; level: number } | null
}

/** Número de la Pokédex nacional (sprites de Esmeralda). */
export const emeraldDex = (id: string): number => (emeraldSprites as Record<string, { dex: number }>)[id]?.dex ?? 0

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
const IV = 20

/** Estadística de Gen 3 con IV fijo, sin EV y naturaleza neutra. */
export const statAt = (base: number, level: number, hp: boolean): number =>
  Math.floor(((2 * base + IV) * level) / 100) + (hp ? level + 10 : 5)

export function candidateOf(id: string, level: number, definition: CampaignDefinition, data: GameData): Candidate {
  const species = definition.species[id]
  const dex = data.dex.species[id]
  const rawTypes = species?.types ?? dex?.types ?? []
  const types = rawTypes.map((type) => type.toLowerCase())
  const evolution = species?.evolutions.find((rule) => rule.method === 'LEVEL' && typeof rule.parameter === 'number')
  return {
    id,
    name: (data.names.species[id] ?? id).toUpperCase(),
    dex: emeraldDex(id),
    types,
    typeNames: rawTypes.map((type) => data.names.types[type] ?? type),
    total: species?.baseStatTotal ?? 0,
    // Shedinja tiene siempre 1 PS (Gen 3), sea cual sea el nivel.
    stats: dex ? STAT_KEYS.map((key, i) => (i === 0 && id === 'shedinja' ? 1 : statAt(dex.baseStats[key], level, i === 0))) : [0, 0, 0, 0, 0, 0],
    // La primera habilidad de los datos coincide con la de Gen 3 en las 386 especies (comprobado el 12/11/2026); el nombre, el de la época.
    ability: dex?.abilities[0] ? emeraldAbilityName(dex.abilities[0], data.names) : '',
    evolution: evolution ? { target: (data.names.species[evolution.target] ?? evolution.target).toUpperCase(), level: Number(evolution.parameter) } : null,
  }
}

/** Reparte un texto en líneas de como mucho `width` píxeles según `measure`. */
export function wrapText(text: string, width: number, measure: (line: string) => number): string[] {
  const lines = ['']
  for (const word of text.split(' ')) {
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word
    if (measure(next) <= width) lines[lines.length - 1] = next
    else lines.push(word)
  }
  return lines
}

/** Líneas de la ventana NOTAS: la evolución por nivel del candidato, en la fuente normal del juego y 144 px. */
export function candidateNotes(candidate: Candidate): string[] {
  const text = candidate.evolution ? esCampaign.draft.evolves(candidate.evolution.target, candidate.evolution.level) : esCampaign.draft.noEvolution
  return wrapText(text, 144, (line) => textWidth(emeraldTheme.font as BitmapFont, line))
}
