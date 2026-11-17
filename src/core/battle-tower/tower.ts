import type { AiKind } from '../../battle/protocol'
import { resolvePwtRival, spanishName, withFixedHiddenPower } from '../challenge'
import { DataError } from '../errors'
import { NO_SYNERGY_TAG } from '../launch'
import { deriveSeed, Prng } from '../prng'
import { buildPlayerTeam, poolWithoutRival, withGenders } from '../team'
import type { Challenge, GameData, ResolvedSet } from '../types'

export const TOWER_ROUNDS = 7
type TowerRival = Pick<Challenge, 'trainer' | 'variant' | 'rivalTeam'>
export type TowerPhase = 'prepare' | 'battle' | 'between' | 'won' | 'lost'

export type TowerRun = {
  seed: string
  dataVersion: string
  ai: Exclude<AiKind, 'lookahead'>
  index: number
  phase: TowerPhase
  team: ResolvedSet[]
  rivals: TowerRival[]
}

/** Fija los siete encuentros y sus sets al crear la serie. */
export function newTowerRun(seed: string, data: GameData, ai: TowerRun['ai'] = 'heuristic'): TowerRun {
  const rng = new Prng(deriveSeed(seed, 'trainers'))
  const leaders = data.trainers.filter((trainer) => trainer.category === 'leader' && trainer.variants.length > 0)
  const champions = data.trainers.filter((trainer) => trainer.category === 'champion' && trainer.variants.length > 0)
  if (leaders.length < TOWER_ROUNDS - 1 || champions.length === 0) {
    throw new DataError('No hay suficientes entrenadores del PWT para la Torre Batalla.')
  }
  const trainers = [...rng.sample(leaders, TOWER_ROUNDS - 1), rng.pick(champions)]
  const rivals = trainers.map(({ id }) => {
    const rival = resolvePwtRival(data, id, deriveSeed(seed, 'rival', id))
    const genders = new Prng(deriveSeed(seed, 'rival-gender', id))
    return { ...rival, rivalTeam: withFixedHiddenPower(withGenders(rival.rivalTeam, data.dex, genders)) }
  })
  const first = rivals[0]
  const pool = poolWithoutRival(data.playerSets, first.trainer.id).filter((set) => !set.tags?.includes(NO_SYNERGY_TAG))
  const rolled = buildPlayerTeam(pool, first.rivalTeam, new Prng(deriveSeed(seed, 'player')), data.dex)
  const named = rolled.team.map((set) => ({ ...set, nameEs: spanishName(data, set.species) }))
  const team = withFixedHiddenPower(withGenders(named, data.dex, new Prng(deriveSeed(seed, 'player-gender'))))
  return { seed, dataVersion: data.dataVersion, ai, index: 0, phase: 'prepare', team, rivals }
}

export function setTowerOrder(run: TowerRun, order: readonly string[]): TowerRun {
  if (run.phase !== 'prepare' || order.length !== run.team.length || new Set(order).size !== run.team.length ||
    order.every((id, index) => id === run.team[index].species)) return run
  const bySpecies = new Map(run.team.map(member => [member.species, member]))
  const team = order.map(id => bySpecies.get(id))
  return team.every(member => member !== undefined) ? { ...run, team } : run
}

export function startTowerRound(run: TowerRun): TowerRun {
  return run.phase === 'prepare' || run.phase === 'between' ? { ...run, phase: 'battle' } : run
}

export function finishTowerRound(run: TowerRun, result: 'win' | 'loss'): TowerRun {
  if (run.phase !== 'battle') return run
  if (result === 'loss') return { ...run, phase: 'lost' }
  if (run.index === TOWER_ROUNDS - 1) return { ...run, phase: 'won' }
  return { ...run, index: run.index + 1, phase: 'between' }
}

export function towerBattleSeed(run: TowerRun): string {
  return deriveSeed(run.seed, 'round', String(run.index))
}
