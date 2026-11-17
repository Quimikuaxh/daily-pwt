import { TOWER_ROUNDS, type TowerRun } from '../core/battle-tower/tower'
import { LocalProgressStore, type ProgressRecord } from './progressStore'
import type { Decision } from './gameStore'

export type TowerBattle = { decisions: Decision[] }
export type TowerRecord = ProgressRecord<TowerRun, TowerBattle>
export const TOWER_STORAGE_KEY = 'daily-pwt:tower:v1'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const text = (value: unknown): value is string => typeof value === 'string'
const stats = (v: unknown) => object(v) && ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every(key => count(v[key]))

function team(value: unknown): boolean {
  return Array.isArray(value) && value.length === 6 && value.every(set =>
    object(set) && set.level === 50 && ['nameEs', 'species', 'nature', 'ability', 'item'].every(key => text(set[key])) &&
    Array.isArray(set.moves) && set.moves.length === 4 && set.moves.every(text) && stats(set.ivs) && stats(set.evs) &&
    (set.gender === undefined || set.gender === 'M' || set.gender === 'F') &&
    (set.hiddenPowerPower === undefined || count(set.hiddenPowerPower)))
}

export function validTowerRecord(value: unknown): value is TowerRecord {
  if (!object(value) || value.version !== 1 || !count(value.revision) || value.revision < 1 || !object(value.state)) return false
  const state = value.state
  if (!text(state.seed) || !text(state.dataVersion) || (state.ai !== 'heuristic' && state.ai !== 'trivial') || !count(state.index) || state.index >= TOWER_ROUNDS ||
    !['prepare', 'battle', 'between', 'won', 'lost'].includes(String(state.phase)) ||
    (state.phase === 'prepare' && state.index !== 0) || (state.phase === 'between' && state.index === 0) ||
    (state.phase === 'won' && state.index !== TOWER_ROUNDS - 1) || !team(state.team) ||
    !Array.isArray(state.rivals) || state.rivals.length !== TOWER_ROUNDS) return false
  const ids = new Set<string>()
  for (const [index, rival] of state.rivals.entries()) {
    if (!object(rival) || !object(rival.trainer) || !object(rival.variant) || !team(rival.rivalTeam)) return false
    const { trainer, variant } = rival
    if (!text(trainer.id) || ids.has(trainer.id) || !text(trainer.nameEs) || !text(trainer.sprite) ||
      (trainer.gender !== 'M' && trainer.gender !== 'F') || trainer.category !== (index === TOWER_ROUNDS - 1 ? 'champion' : 'leader') ||
      ![null, 'kanto', 'johto', 'hoenn', 'sinnoh', 'unova'].includes(trainer.region as string | null) ||
      !['id', 'sourceTournament', 'sourceUrl'].every(key => text(variant[key]))) return false
    ids.add(trainer.id)
  }
  if (new Set((state.team as { species: string }[]).map(member => member.species)).size !== 6) return false
  if (state.phase !== 'battle') return value.battle === null
  return object(value.battle) && Array.isArray(value.battle.decisions) && value.battle.decisions.every(decision =>
    object(decision) && (decision.type === 'forfeit' ||
      ((decision.type === 'move' || decision.type === 'switch') && count(decision.slot) && decision.slot > 0)))
}

export class LocalTowerStore extends LocalProgressStore<TowerRun, TowerBattle> {
  constructor(storage: Storage | null) {
    super(storage, TOWER_STORAGE_KEY, validTowerRecord)
  }
}
