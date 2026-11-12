/**
 * Paneles laterales de la campaña en escritorio (PRD §0, 12/11/2026): «Tu campaña» (Ficha de Entrenador) y «Tu equipo» (pantalla de
 * equipo) en los menús, y en el combate uno por bando con el estilo de la ficha del Domo Batalla. Aquí, cuándo caben y qué enseña cada
 * Pokémon del combate; el dibujo, en CampaignSide.tsx.
 */
import type { BattleRequest, BattleSet, EngineInit, MonView, SideView } from '../../battle/protocol'
import type { Boosts } from '../../battle/fieldState'
import { consoleScale } from '../battle/useStageScale'
import { toId } from '../../core/id'
import type { StatsTable } from '../../core/types'

/** Tamaño de los paneles en píxeles del juego; se pintan a x2. */
export const CAMPAIGN_PANEL = { w: 184, h: 296 }
export const BATTLE_PANEL = { w: 184, h: 312 }
export const PANEL_SCALE = 2
/** Hueco entre la consola y cada panel, y margen mínimo hasta el borde de la ventana (px de pantalla). */
const PANEL_GAP = 24
const PANEL_MARGIN = 16
/** Cabecera del portal (Daily PWT · Volver a Hoy). */
const HEADER_HEIGHT = 64
/** Lienzo de la consola de Esmeralda (dos pantallas de 240 x 160). */
const CONSOLE = { w: 240, h: 320 }

/**
 * Distancia del centro de la página al borde interior de cada panel, o null si no caben a los lados de la consola sin tocarla ni salirse de
 * la ventana. La consola se escala con la regla de ConsoleStage (`consoleScale`) sobre el mismo hueco, así que los paneles nunca la achican.
 */
export function sidePanelOffset(viewportWidth: number, viewportHeight: number, reservedHeight: number, panelHeight: number): number | null {
  const scale = consoleScale(viewportWidth, viewportHeight - reservedHeight, CONSOLE.w, CONSOLE.h)
  const half = (CONSOLE.w * scale) / 2
  const fitsWidth = viewportWidth / 2 - half >= CAMPAIGN_PANEL.w * PANEL_SCALE + PANEL_GAP + PANEL_MARGIN
  const fitsHeight = viewportHeight - HEADER_HEIGHT >= panelHeight * PANEL_SCALE + PANEL_MARGIN
  return fitsWidth && fitsHeight ? half + PANEL_GAP : null
}

/** Estado alterado con la abreviatura de Esmeralda (gStatusConditionString_*). */
export const STATUS_SHORT: Readonly<Record<string, string>> = { par: 'PAR', slp: 'DOR', psn: 'ENV', tox: 'ENV', brn: 'QUE', frz: 'CON' }

/** Los sets de los dos bandos del combate (los del registro, cuando el motor lo ha preparado). */
export type SideSets = Pick<EngineInit, 'player' | 'rival'>

export type SideMove = { id: string; pp: number | null; maxPp: number | null }
export type SideMon = {
  /** Posición en el equipo de entrada (0…). */
  index: number
  species: string
  level: number
  /** PS: los reales en el jugador; en el rival, el porcentaje (`percentOnly`), como su caja de PS. */
  hp: number
  maxHp: number
  percentOnly: boolean
  status: string | null
  fainted: boolean
  active: boolean
  item: string
  ability: string
  stats: StatsTable
  moves: SideMove[]
}

type SideInput = {
  sets: readonly BattleSet[]
  side: SideView | null
  /** Petición del jugador: de ella salen sus estadísticas exactas. */
  request?: BattleRequest | null
  /** Estadísticas calculadas (las del rival, y las del jugador si la petición no las trae). */
  statsOf: (set: BattleSet) => StatsTable
  player: boolean
}

const speciesOfDetails = (details: string) => toId(details.split(',')[0])

/** Los Pokémon de un bando en el orden de entrada, con lo que se sabe de cada uno en este momento del combate. */
export function sideMons({ sets, side, request, statsOf, player }: SideInput): SideMon[] {
  const requested = request?.side.pokemon ?? []
  const seen = new Map<string, number>()
  return sets.map((set, index) => {
    const mon: MonView | undefined = side?.team.find((candidate, i) => (candidate.teamIndex ?? i) === index)
    // Con especies repetidas, la n-ésima de la petición es la n-ésima del equipo.
    const nth = seen.get(set.species) ?? 0
    seen.set(set.species, nth + 1)
    const fromRequest = requested.filter((pokemon) => speciesOfDetails(pokemon.details) === set.species)[nth]
    const computed = statsOf(set)
    const stats = fromRequest?.stats ? { ...computed, ...fromRequest.stats, hp: computed.hp } as StatsTable : computed
    const fainted = mon?.fainted ?? false
    const percentOnly = !player
    const hp = fainted ? 0 : percentOnly ? mon?.hpPercent ?? 100 : mon?.hp ?? stats.hp
    const maxHp = percentOnly ? 100 : mon?.maxHp ?? stats.hp
    const pp = new Map((mon?.moves ?? []).map((move) => [move.id, move]))
    return {
      index, species: set.species, level: set.level, hp, maxHp, percentOnly,
      status: fainted ? null : mon?.status ?? null, fainted,
      active: side?.active !== null && side?.active !== undefined && (side.team[side.active]?.teamIndex ?? side.active) === index,
      item: mon?.item ?? set.item, ability: set.ability, stats,
      moves: set.moves.map((id) => ({ id, pp: pp.get(id)?.pp ?? null, maxPp: pp.get(id)?.maxPp ?? null })),
    }
  })
}

/** Subida o bajada de una estadística como en Esmeralda (+1, −2), o '' si no hay. */
export const stageText = (boosts: Boosts | null, stat: keyof StatsTable): string => {
  const stage = stat === 'hp' ? 0 : boosts?.[stat] ?? 0
  return stage > 0 ? `+${stage}` : stage < 0 ? `-${-stage}` : ''
}
