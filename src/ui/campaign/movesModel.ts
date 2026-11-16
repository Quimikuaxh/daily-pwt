/**
 * Modelo de la pantalla Movimientos de la campaña (D7, maqueta aprobada el 11/11/2026): los movimientos legales de un miembro con
 * sus datos y descripción en español de la generación de la campaña y
 * su origen (nivel o MT/MO), y las operaciones de aprender y olvidar. La lista va como el Recordador: por nivel y después las MT/MO.
 */
import type { CampaignDefinition, CampaignState } from '../../core/nuzlocke/campaign'
import { availableCampaignMoves, campaignMemberMoves } from '../../core/nuzlocke/progression'
import type { GameData } from '../../core/types'
import { rulesOf } from '../../core/nuzlocke/rules'
import unovaCalendar from '../../../data/nuzlocke/unova-n2b2-calendar.json'
import { moveDescription } from '../battle/party/summaryModel'
import { machineLabel } from './bagModel'
import moveData from '../../generated/emerald/moves.json'
import descriptions from '../../../data/nuzlocke/emerald-move-descriptions-es.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import { emeraldMoveName } from './emeraldNames'

export const MAX_MOVES = 4

export type MoveInfo = {
  id: string
  name: string
  type: string
  typeName: string
  category: 'Physical' | 'Special' | 'Status'
  power: number | null
  accuracy: number | null
  pp: number
  /** Dos líneas como mucho, separadas por «\n» (UT-174). */
  text: string
  /** Nivel al que lo aprende o la máquina que lo enseña (MT05, MO01). */
  source: { level: number } | { machine: string }
}

/** Id del icono de tipo (`tipo-*`): el «???» de MALDICIÓN en Gen 3 es `mystery` (graphics/types/mystery.png; Jose, 12/11/2026). */
export const typeIconId = (type: string): string => (type === '???' ? 'mystery' : type.toLowerCase())

type MoveRow = { type: string; category: string; power: number | null; accuracy: number | null; pp: number }
const rows = moveData as Record<string, MoveRow>
const spanish = descriptions.moves as Record<string, string>
const machineOf = Object.fromEntries(Object.entries(progression.machines as Record<string, string>).map(([machine, move]) => [move, machine.toUpperCase().replace(/^HM/, 'MO').replace(/^TM/, 'MT')]))

const unovaMachineOf = Object.fromEntries(Object.entries(unovaCalendar.machines).map(([machine, { move }]) => [move, machineLabel(machine)]))

export function moveInfo(id: string, data: GameData, source: MoveInfo['source'], generation: 3 | 5 = 3): MoveInfo {
  const row = generation === 5 ? data.dex.moves[id] : rows[id]
  return {
    id,
    name: generation === 5 ? data.names.moves[id] ?? id : emeraldMoveName(id, data.names),
    type: typeIconId(row.type),
    typeName: (data.names.types[row.type] ?? row.type).toUpperCase(),
    category: row.category as MoveInfo['category'],
    power: 'basePower' in row ? row.basePower || null : row.power,
    accuracy: row.accuracy === true ? null : row.accuracy,
    pp: row.pp,
    text: (generation === 5 ? moveDescription(id) : spanish[id]) ?? '',
    source,
  }
}

type Member = CampaignState['members'][number]

/** Movimientos legales del miembro, por nivel de aprendizaje (formas recorridas) y después las MT/MO por número. */
export function legalMoves(definition: CampaignDefinition, state: CampaignState, member: Member, data: GameData): MoveInfo[] {
  const generation = rulesOf(definition)?.generation ?? 3
  const machineLabels = generation === 5 ? unovaMachineOf : machineOf
  const legal = new Set(availableCampaignMoves(definition, state, member))
  const levels = new Map<string, number>()
  for (const stage of [...member.history, { species: member.species, evolvedAt: member.level }]) {
    for (const entry of definition.species[stage.species].levelUp) {
      if (entry.level <= stage.evolvedAt && legal.has(entry.move) && !levels.has(entry.move)) levels.set(entry.move, entry.level)
    }
  }
  const byLevel = [...levels].sort((a, b) => a[1] - b[1]).map(([id, level]) => moveInfo(id, data, { level }, generation))
  const machines = [...legal].filter((id) => !levels.has(id)).sort((a, b) => (machineLabels[a] ?? a).localeCompare(machineLabels[b] ?? b))
    .map((id) => moveInfo(id, data, { machine: machineLabels[id] ?? '' }, generation))
  return [...byLevel, ...machines]
}

/** Movimientos con los que entra el miembro en la pantalla: los elegidos o, si no hay, los de por defecto. */
export const equippedMoves = (definition: CampaignDefinition, state: CampaignState, member: Member): string[] =>
  campaignMemberMoves(definition, state, member)

/** Aprende un movimiento: si hay hueco, lo añade; si no, hace falta `forget` (índice del que se olvida). */
export function learnMove(equipped: readonly string[], move: string, forget?: number): string[] | null {
  if (equipped.includes(move)) return null
  if (equipped.length < MAX_MOVES) return [...equipped, move]
  if (forget === undefined || forget < 0 || forget >= equipped.length) return null
  return equipped.map((id, i) => (i === forget ? move : id))
}
