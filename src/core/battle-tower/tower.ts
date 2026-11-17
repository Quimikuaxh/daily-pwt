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
  /** Rivales de la serie en curso: 6 líderes y un campeón, o los líderes que quedan en la serie final. */
  rivals: TowerRival[]
  /** Serie en curso de la racha (0 la primera; ausente en las guardadas antes de poder seguir). */
  series?: number
  /** Entrenadores vencidos en las series anteriores de la racha: no vuelven a salir. */
  beaten?: string[]
}

const inTower = (trainer: GameData['trainers'][number]) => (trainer.category === 'leader' || trainer.category === 'champion') && trainer.variants.length > 0

/** Entrenadores del PWT que pueden salir en la Torre (53: 46 líderes y 7 campeones). */
export function towerTrainerTotal(data: GameData): number {
  return data.trainers.filter(inTower).length
}

/**
 * Sortea y resuelve una serie (Jose, 17/11/2026, PRD §0 «Torre: seguir con el mismo equipo»): 6 líderes y 1 campeón de los que no han
 * salido en la racha mientras queden campeones; agotados, los líderes que quedan forman la serie final. La primera serie conserva las
 * semillas de antes para que las partidas guardadas no cambien.
 */
function drawSeries(seed: string, data: GameData, series: number, beaten: readonly string[]): TowerRival[] {
  const rng = new Prng(series === 0 ? deriveSeed(seed, 'trainers') : deriveSeed(seed, 'trainers', String(series)))
  const left = data.trainers.filter((trainer) => inTower(trainer) && !beaten.includes(trainer.id))
  const leaders = left.filter((trainer) => trainer.category === 'leader')
  const champions = left.filter((trainer) => trainer.category === 'champion')
  if (series === 0 && (leaders.length < TOWER_ROUNDS - 1 || champions.length === 0)) {
    throw new DataError('No hay suficientes entrenadores del PWT para la Torre Batalla.')
  }
  if (leaders.length + champions.length === 0) throw new DataError('No quedan entrenadores en la Torre Batalla.')
  const trainers = champions.length > 0
    ? [...rng.sample(leaders, Math.min(TOWER_ROUNDS - 1, leaders.length)), rng.pick(champions)]
    : rng.sample(leaders, leaders.length)
  return trainers.map(({ id }) => {
    const rival = resolvePwtRival(data, id, deriveSeed(seed, 'rival', id))
    const genders = new Prng(deriveSeed(seed, 'rival-gender', id))
    return { ...rival, rivalTeam: withFixedHiddenPower(withGenders(rival.rivalTeam, data.dex, genders)) }
  })
}

/** Fija los encuentros de la primera serie y sus sets al crear la racha. */
export function newTowerRun(seed: string, data: GameData, ai: TowerRun['ai'] = 'heuristic'): TowerRun {
  const rivals = drawSeries(seed, data, 0, [])
  const first = rivals[0]
  const pool = poolWithoutRival(data.playerSets, first.trainer.id).filter((set) => !set.tags?.includes(NO_SYNERGY_TAG))
  const rolled = buildPlayerTeam(pool, first.rivalTeam, new Prng(deriveSeed(seed, 'player')), data.dex)
  const named = rolled.team.map((set) => ({ ...set, nameEs: spanishName(data, set.species) }))
  const team = withFixedHiddenPower(withGenders(named, data.dex, new Prng(deriveSeed(seed, 'player-gender'))))
  return { seed, dataVersion: data.dataVersion, ai, index: 0, phase: 'prepare', team, rivals }
}

/** Vencidos en toda la racha (las series anteriores y, si se ha ganado, la de ahora). */
export function towerBeaten(run: TowerRun): number {
  return (run.beaten?.length ?? 0) + (run.phase === 'won' ? run.rivals.length : run.index)
}

/** Rivales que aún no han salido en la racha; 0 al completar la Torre. */
export function towerRemaining(run: TowerRun, data: GameData): number {
  return towerTrainerTotal(data) - (run.beaten?.length ?? 0) - run.rivals.length
}

/** Seguir con el mismo equipo tras ganar una serie: sortea la siguiente sin repetir y vuelve a la pausa antes del primer rival. */
export function continueTowerRun(run: TowerRun, data: GameData): TowerRun {
  if (run.phase !== 'won' || towerRemaining(run, data) <= 0) return run
  const beaten = [...(run.beaten ?? []), ...run.rivals.map(({ trainer }) => trainer.id)]
  const series = (run.series ?? 0) + 1
  return { ...run, series, beaten, index: 0, phase: 'between', rivals: drawSeries(run.seed, data, series, beaten) }
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
  if (run.index === run.rivals.length - 1) return { ...run, phase: 'won' }
  return { ...run, index: run.index + 1, phase: 'between' }
}

export function towerBattleSeed(run: TowerRun): string {
  // La primera serie conserva la semilla de antes de poder seguir: los combates guardados se reanudan igual.
  const series = run.series ?? 0
  return deriveSeed(run.seed, 'round', series === 0 ? String(run.index) : `${series}:${run.index}`)
}
