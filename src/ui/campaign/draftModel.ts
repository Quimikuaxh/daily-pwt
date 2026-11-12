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
import { emeraldAbilityName, emeraldAbilityText, emeraldItemName } from './emeraldNames'
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
  /** Descripción de la habilidad, en una línea de la ventana HABILIDAD. */
  abilityText: string
  evolution: { target: string; level: number } | null
  /** Cómo evoluciona, por cualquier método (`evolutionText`). */
  evolutionText: string
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
    abilityText: dex?.abilities[0] ? emeraldAbilityText(dex.abilities[0]) : '',
    evolution: evolution ? { target: (data.names.species[evolution.target] ?? evolution.target).toUpperCase(), level: Number(evolution.parameter) } : null,
    evolutionText: evolutionText(species?.evolutions ?? [], (target) => (data.names.species[target] ?? target).toUpperCase(),
      (item) => emeraldItemName(item, data.names)),
  }
}

type EvolutionRule = { method: string; parameter: string | number; target: string }
const d = esCampaign.draft

/**
 * Cómo evoluciona, por cualquier método (Jose, 12/11/2026): con una sola forma, la frase entera («Evoluciona a CLOYSTER con PIEDRA
 * AGUA.»); con varias, cada forma con su método entre paréntesis, agrupando las de un mismo método («… VAPOREON, JOLTEON o FLAREON
 * (piedras), ESPEON (amistad de día)…»). Shedinja no es una evolución del miembro y no sale.
 */
export function evolutionText(rules: readonly EvolutionRule[], name: (species: string) => string, item: (id: string) => string): string {
  const own = rules.filter((rule) => rule.method !== 'LEVEL_SHEDINJA')
  if (!own.length) return d.noEvolution
  const how = (rule: EvolutionRule): string => {
    if (rule.method.startsWith('LEVEL')) return d.how.level(Number(rule.parameter))
    if (rule.method === 'ITEM') return d.how.item(item(String(rule.parameter)))
    if (rule.method === 'TRADE_ITEM') return d.how.tradeItem(item(String(rule.parameter)))
    if (rule.method === 'TRADE') return d.how.trade
    if (rule.method === 'FRIENDSHIP_DAY') return d.how.friendshipDay
    if (rule.method === 'FRIENDSHIP_NIGHT') return d.how.friendshipNight
    if (rule.method.startsWith('FRIENDSHIP')) return d.how.friendship
    return d.how.beauty
  }
  if (own.length === 1) return d.evolvesBy(name(own[0].target), how(own[0]))
  // Varias: por método; las piedras distintas, juntas.
  const groups = new Map<string, string[]>()
  const label = (rule: EvolutionRule): string => {
    if (rule.method.startsWith('LEVEL')) return d.short.level(Number(rule.parameter))
    if (rule.method === 'ITEM') return own.filter((other) => other.method === 'ITEM').length > 2 ? d.short.items : d.short.item(item(String(rule.parameter)))
    if (rule.method === 'TRADE_ITEM') return d.short.tradeItem(item(String(rule.parameter)))
    if (rule.method === 'TRADE') return d.short.trade
    if (rule.method.startsWith('FRIENDSHIP')) return how(rule).replace(/^por /, '')
    return d.short.beauty
  }
  for (const rule of own) {
    const key = label(rule)
    const targets = groups.get(key) ?? []
    if (!targets.includes(name(rule.target))) targets.push(name(rule.target))
    groups.set(key, targets)
  }
  const join = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} o ${items.at(-1)}` : items[0])
  const full = d.evolvesMany(join([...groups].map(([key, targets]) => `${join(targets)} (${key})`)))
  if (notesLines(full).length <= NOTES_LINES) return full
  // Si no cabe en NOTAS: todas las formas y los métodos sin su objeto (Clamperl, Eevee); si tampoco, solo los métodos.
  const methods = [...new Set([...groups.keys()].map((key) => key.replace(/ con .*$/, '').replace(/ de (día|noche)$/, '')))]
  const all = [...new Set([...groups.values()].flat())]
  const compact = d.evolvesMany(`${join(all)} (${join(methods)})`)
  return notesLines(compact).length <= NOTES_LINES ? compact : d.evolvesWays(all.length, join(methods))
}

/** Líneas de la ventana NOTAS (la tercera queda justo encima del borde inferior). */
export const NOTES_LINES = 3
const notesLines = (text: string) => wrapText(text, 144, (line) => textWidth(emeraldTheme.font as BitmapFont, line))

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
  return notesLines(candidate.evolutionText)
}
