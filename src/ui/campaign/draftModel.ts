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
    dex: (emeraldSprites as Record<string, { dex: number }>)[id]?.dex ?? 0,
    types,
    typeNames: rawTypes.map((type) => data.names.types[type] ?? type),
    total: species?.baseStatTotal ?? 0,
    stats: dex ? STAT_KEYS.map((key, i) => statAt(dex.baseStats[key], level, i === 0)) : [0, 0, 0, 0, 0, 0],
    ability: (data.names.abilities[dex?.abilities[0] ?? ''] ?? dex?.abilities[0] ?? '').toUpperCase(),
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
