import { Dex } from '@pkmn/sim'
import type { BattleGeneration } from '../protocol'

const dexByGeneration = { 3: Dex.forGen(3), 5: Dex.forGen(5) }

export type StatusId = 'par' | 'brn' | 'slp' | 'psn' | 'tox' | 'frz'
export type BoostId = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion'

/** Qué hace un movimiento a efectos de la IA, sacado de los datos del simulador para la generación del combate (no de listas escritas a mano). */
export type MoveInfo = {
  id: string
  kind: 'attack' | 'weather' | 'inflictStatus' | 'setup' | 'heal' | 'hazard' | 'other'
  category: 'Physical' | 'Special' | 'Status'
  type: string
  accuracy: number
  /** Dos turnos, recarga o autodestrucción: su daño no se puede tratar como un golpe normal. */
  twoTurn: boolean
  recharge: boolean
  suicide: boolean
  /** Solo tiene sentido en situaciones que la IA no ve (Puño Certero, Sorpresa...). */
  unreliable: boolean
  weather?: string
  status?: StatusId
  boosts?: Partial<Record<BoostId, number>>
  hazard?: 'stealthrock' | 'spikes' | 'toxicspikes'
  ignoresImmunity: boolean
}

const UNRELIABLE_MOVES = new Set(['fakeout', 'focuspunch', 'dreameater', 'snore', 'suckerpunch', 'counter', 'mirrorcoat', 'metalburst', 'endeavor'])
const DELAYED_HEAL_MOVES = new Set(['wish', 'healingwish', 'lunardance'])
const INFLICTABLE: readonly string[] = ['par', 'brn', 'slp', 'psn', 'tox', 'frz']
const HAZARDS: readonly string[] = ['stealthrock', 'spikes', 'toxicspikes']

const cache = { 3: new Map<string, MoveInfo>(), 5: new Map<string, MoveInfo>() }

function classify(id: string, generation: BattleGeneration): MoveInfo {
  const dex = dexByGeneration[generation]
  const data = dex.moves.get(id)
  const base = {
    id,
    category: data.category,
    type: data.type,
    accuracy: data.accuracy === true ? 1 : data.accuracy / 100,
    twoTurn: !!data.flags.charge,
    recharge: !!data.flags.recharge,
    suicide: !!data.selfdestruct,
    unreliable: UNRELIABLE_MOVES.has(id),
    ignoresImmunity: data.ignoreImmunity !== false,
  }
  if (!data.exists) return { ...base, kind: 'other', category: 'Status', accuracy: 1 }
  if (data.category !== 'Status') return { ...base, kind: 'attack' }

  if (data.weather) return { ...base, kind: 'weather', weather: dex.toID(data.weather) }
  if (data.sideCondition && HAZARDS.includes(data.sideCondition)) {
    return { ...base, kind: 'hazard', hazard: data.sideCondition as MoveInfo['hazard'] }
  }
  if (data.target === 'self' && data.flags.heal && !DELAYED_HEAL_MOVES.has(id)) return { ...base, kind: 'heal' }
  if (data.target === 'self' && data.boosts) return { ...base, kind: 'setup', boosts: data.boosts as MoveInfo['boosts'] }
  if (data.status && INFLICTABLE.includes(data.status) && data.target !== 'self') {
    return { ...base, kind: 'inflictStatus', status: data.status as StatusId }
  }
  return { ...base, kind: 'other' }
}

export function moveInfo(moveId: string, generation: BattleGeneration = 5): MoveInfo {
  const moves = cache[generation]
  let info = moves.get(moveId)
  if (!info) {
    info = classify(moveId, generation)
    moves.set(moveId, info)
  }
  return info
}

export function speciesTypes(speciesId: string, generation: BattleGeneration = 5): string[] {
  return [...dexByGeneration[generation].species.get(speciesId).types]
}

/** Multiplicador de tipo de un movimiento de ese tipo sobre un Pokémon de esa especie. */
export function typeMultiplier(attackType: string, defenderSpeciesId: string, generation: BattleGeneration = 5): number {
  const dex = dexByGeneration[generation]
  return speciesTypes(defenderSpeciesId, generation).reduce((multiplier, defenderType) => {
    if (!dex.getImmunity(attackType, defenderType)) return 0
    return multiplier * 2 ** dex.getEffectiveness(attackType, defenderType)
  }, 1)
}
