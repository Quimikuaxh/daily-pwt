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
  // Series encadenadas (PRD §0, 17/11/2026): `series` y `beaten` faltan en las guardadas antes; la serie final tiene menos rivales.
  const series = state.series === undefined ? 0 : state.series
  const beaten = state.beaten === undefined ? [] : state.beaten
  if (!count(series) || !Array.isArray(beaten) || !beaten.every(text) || new Set(beaten).size !== beaten.length || (series === 0 && beaten.length > 0)) return false
  const rounds = Array.isArray(state.rivals) ? state.rivals.length : 0
  if (!text(state.seed) || !text(state.dataVersion) || (state.ai !== 'heuristic' && state.ai !== 'trivial') || !count(state.index) ||
    rounds < 1 || rounds > TOWER_ROUNDS || state.index >= rounds ||
    !['prepare', 'battle', 'between', 'won', 'lost'].includes(String(state.phase)) ||
    (state.phase === 'prepare' && (state.index !== 0 || series !== 0)) || (state.phase === 'between' && state.index === 0 && series === 0) ||
    (state.phase === 'won' && state.index !== rounds - 1) || !team(state.team)) return false
  const ids = new Set<string>(beaten as string[])
  for (const [index, rival] of (state.rivals as unknown[]).entries()) {
    if (!object(rival) || !object(rival.trainer) || !object(rival.variant) || !team(rival.rivalTeam)) return false
    const { trainer, variant } = rival
    // El campeón solo cierra una serie completa; la serie final (sin campeones) es toda de líderes.
    const category = index === TOWER_ROUNDS - 1 ? 'champion' : 'leader'
    if (!text(trainer.id) || ids.has(trainer.id) || !text(trainer.nameEs) || !text(trainer.sprite) ||
      (trainer.gender !== 'M' && trainer.gender !== 'F') || trainer.category !== category ||
      ![null, 'kanto', 'johto', 'hoenn', 'sinnoh', 'unova'].includes(trainer.region as string | null) ||
      !['id', 'sourceTournament', 'sourceUrl'].every(key => text(variant[key]))) return false
    ids.add(trainer.id)
  }
  if (series === 0 && rounds !== TOWER_ROUNDS) return false
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
