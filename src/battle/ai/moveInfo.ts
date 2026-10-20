import { Dex } from '@pkmn/sim'

const gen5 = Dex.forGen(5)

export type StatusId = 'par' | 'brn' | 'slp' | 'psn' | 'tox' | 'frz'
export type BoostId = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion'

/** Qué hace un movimiento a efectos de la IA, sacado de los datos Gen 5 del simulador (no de listas escritas a mano). */
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

const cache = new Map<string, MoveInfo>()

function classify(id: string): MoveInfo {
  const data = gen5.moves.get(id)
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

  if (data.weather) return { ...base, kind: 'weather', weather: gen5.toID(data.weather) }
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

export function moveInfo(moveId: string): MoveInfo {
  let info = cache.get(moveId)
  if (!info) {
    info = classify(moveId)
    cache.set(moveId, info)
  }
  return info
}

export function speciesTypes(speciesId: string): string[] {
  return [...gen5.species.get(speciesId).types]
}

/** Multiplicador de tipo Gen 5 de un movimiento de ese tipo sobre un Pokémon de esa especie. */
export function typeMultiplier(attackType: string, defenderSpeciesId: string): number {
  return speciesTypes(defenderSpeciesId).reduce((multiplier, defenderType) => {
    if (!gen5.getImmunity(attackType, defenderType)) return 0
    return multiplier * 2 ** gen5.getEffectiveness(attackType, defenderType)
  }, 1)
}
