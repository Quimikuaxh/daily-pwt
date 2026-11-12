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
import { moveInfo, type MoveInfo } from './movesModel'
import { defaultMoves } from '../../core/nuzlocke/progression'
import { EMERALD_TRADE_LEVEL } from '../../core/nuzlocke/draftAvailability'
import moveData from '../../generated/emerald/moves.json'
import emeraldCalendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import emeraldEncounters from '../../../data/nuzlocke/hoenn-emerald.json'

const moveRows = moveData as Record<string, unknown>
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
  /** Los movimientos con que llegaría: los cuatro últimos aprendidos por nivel en sus formas (Jose, 12/11/2026). */
  moves: MoveInfo[]
}

/** Número de la Pokédex nacional (sprites de Esmeralda). */
export const emeraldDex = (id: string): number => (emeraldSprites as Record<string, { dex: number }>)[id]?.dex ?? 0

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
const IV = 20

/** Estadística de Gen 3 con IV fijo, sin EV y naturaleza neutra. */
export const statAt = (base: number, level: number, hp: boolean): number =>
  Math.floor(((2 * base + IV) * level) / 100) + (hp ? level + 10 : 5)

export function candidateOf(id: string, level: number, definition: CampaignDefinition, data: GameData, history: readonly { species: string; evolvedAt: number }[] = []): Candidate {
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
    moves: species ? defaultMoves(definition.species, { id, species: id, level, history: [...history], fainted: false, victories: 0 } as never)
      .filter((move) => moveRows[move]).map((move) => moveInfo(move, data, { level: 0 })) : [],
  }
}

type EvolutionRule = { method: string; parameter: string | number; target: string }
/** Condiciones de la campaña de Hoenn (calendario aprobado): victorias para la amistad y rival tras el que llega la belleza. */
const EVOLUTION_CONDITIONS = (() => {
  const index = emeraldCalendar.milestones.indexOf(emeraldCalendar.beautyBefore)
  const rival = (emeraldEncounters.encounters as readonly { id: string; nameEs: string }[]).find((encounter) => encounter.id === emeraldCalendar.milestones[index - 1])
  return { friendshipWins: emeraldCalendar.friendshipWins, beautyRival: rival?.nameEs ?? '' }
})()
const d = esCampaign.draft

/**
 * Cómo evoluciona en la campaña (Jose, 12/11/2026), por cualquier método: con una sola forma, la frase entera («Evoluciona a CLOYSTER
 * con PIEDRA AGUA.»); con varias, cada una con su condición entre paréntesis («Evoluciona a SLOWBRO (Nv37) o SLOWKING (con ROCA DEL
 * REY).»), juntando las de una misma condición. Las condiciones son las de la campaña: con objeto basta tenerlo (sin intercambio), las
 * de intercambio, en el Nv37 (y con el objeto si lo piden), la amistad llega tras `friendshipWins` victorias y la belleza, tras vencer al
 * rival anterior a `beautyBefore`. Shedinja no es una evolución del miembro y no sale. Si no cabe en NOTAS, se resume.
 */
export function evolutionText(rules: readonly EvolutionRule[], name: (species: string) => string, item: (id: string) => string,
  conditions: { friendshipWins: number; beautyRival: string } = EVOLUTION_CONDITIONS): string {
  const own = rules.filter((rule) => rule.method !== 'LEVEL_SHEDINJA')
  if (!own.length) return d.noEvolution
  const how = (rule: EvolutionRule): string => {
    if (rule.method.startsWith('LEVEL')) return d.how.level(Number(rule.parameter))
    if (rule.method === 'ITEM') return d.how.item(item(String(rule.parameter)))
    // Intercambio: en la campaña, en el Nv37 (y con el objeto si lo pide).
    if (rule.method === 'TRADE_ITEM') return d.how.levelItem(EMERALD_TRADE_LEVEL, item(String(rule.parameter)))
    if (rule.method === 'TRADE') return d.how.level(EMERALD_TRADE_LEVEL)
    if (rule.method.startsWith('FRIENDSHIP')) return d.how.friendship(conditions.friendshipWins)
    return d.how.beauty(conditions.beautyRival)
  }
  if (own.length === 1) return d.evolvesBy(name(own[0].target), how(own[0]))
  // Entre paréntesis, el objeto sin «con» (cabe mejor en NOTAS): «SLOWKING (ROCA DEL REY)».
  const label = (rule: EvolutionRule) => (rule.method.startsWith('LEVEL') ? d.short.level(Number(rule.parameter))
    : rule.method === 'TRADE' ? d.short.level(EMERALD_TRADE_LEVEL)
      : rule.method === 'TRADE_ITEM' ? d.short.levelItem(EMERALD_TRADE_LEVEL, item(String(rule.parameter)))
        : rule.method === 'ITEM' ? item(String(rule.parameter)) : how(rule))
  const groups = new Map<string, string[]>()
  for (const rule of own) {
    const targets = groups.get(label(rule)) ?? []
    if (!targets.includes(name(rule.target))) targets.push(name(rule.target))
    groups.set(label(rule), targets)
  }
  const join = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} o ${items.at(-1)}` : items[0])
  const full = d.evolvesMany(join([...groups].map(([key, targets]) => `${join(targets)} (${key})`)))
  if (notesLines(full).length <= NOTES_LINES) return full
  // Todas por intercambio con objeto (Clamperl): el nivel delante y cada forma con su objeto.
  if (own.every((rule) => rule.method === 'TRADE_ITEM')) {
    const shared = d.evolvesAtLevel(EMERALD_TRADE_LEVEL, join(own.map((rule) => `${name(rule.target)} (${item(String(rule.parameter))})`)))
    if (notesLines(shared).length <= NOTES_LINES) return shared
  }
  const itemKeys = new Set(own.filter((rule) => rule.method === 'ITEM').map((rule) => item(String(rule.parameter))))
  // Si no cabe (Eevee): las piedras juntas; si aun así no cabe, solo cuántas formas y de qué maneras.
  const stones = new Map<string, string[]>()
  for (const [key, targets] of groups) {
    const k = itemKeys.has(key) ? d.short.items : key
    stones.set(k, [...(stones.get(k) ?? []), ...targets])
  }
  const compact = d.evolvesMany(join([...stones].map(([key, targets]) => `${join(targets)} (${key})`)))
  return notesLines(compact).length <= NOTES_LINES ? compact : d.evolvesWays(own.length, join([...stones.keys()]))
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
