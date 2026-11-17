import { describe, expect, it } from 'vitest'
import { loadGameData } from '../../data/gameData'
import { continueTowerRun, finishTowerRound, newTowerRun, setTowerOrder, startTowerRound, towerBattleSeed, towerBeaten, towerRemaining, towerTrainerTotal, TOWER_ROUNDS, type TowerRun } from './tower'

const data = loadGameData()
const run = newTowerRun('tower-test', data)

describe('Torre Batalla', () => {
  it('sortea seis líderes distintos, un campeón al final y un equipo fijo reproducible', () => {
    expect(run.rivals).toHaveLength(7)
    expect(new Set(run.rivals.map(({ trainer }) => trainer.id)).size).toBe(7)
    expect(run.rivals.map(({ trainer }) => trainer.category)).toEqual([...Array(6).fill('leader'), 'champion'])
    expect(run.team).toHaveLength(6)
    expect(newTowerRun('tower-test', data)).toEqual(run)
    expect(newTowerRun('another-run', data).rivals).not.toEqual(run.rivals)
  })

  it('solo permite recolocar el equipo antes del primer combate', () => {
    const initialOrder = run.team.map(member => member.species)
    const reordered = setTowerOrder(run, [initialOrder[2], initialOrder[1], initialOrder[0], ...initialOrder.slice(3)])
    expect(reordered.team).toEqual([run.team[2], run.team[1], run.team[0], ...run.team.slice(3)])
    expect(setTowerOrder(reordered, Array(6).fill(initialOrder[0]))).toBe(reordered)
    const battle = startTowerRound(reordered)
    expect(setTowerOrder(battle, initialOrder)).toBe(battle)
    const between = finishTowerRound(battle, 'win')
    expect(setTowerOrder(between, initialOrder)).toBe(between)
    expect(startTowerRound(between).team).toBe(reordered.team)
  })

  it('hace una pausa por victoria, conserva la plantilla y termina al ganar la última ronda', () => {
    let current = run
    const seeds = new Set<string>()
    for (let index = 0; index < TOWER_ROUNDS; index += 1) {
      expect(current.index).toBe(index)
      const battle = startTowerRound(current)
      expect(battle.phase).toBe('battle')
      seeds.add(towerBattleSeed(battle))
      current = finishTowerRound(battle, 'win')
      expect(current.team).toBe(run.team)
      expect(current.phase).toBe(index === 6 ? 'won' : 'between')
      expect(finishTowerRound(current, 'win')).toBe(current)
    }
    expect(seeds.size).toBe(7)
    expect(startTowerRound(current)).toBe(current)
  })

  it('termina al perder sin sortear ni avanzar otro rival', () => {
    const lost = finishTowerRound(startTowerRound(run), 'loss')
    expect(lost.phase).toBe('lost')
    expect(lost.index).toBe(run.index)
    expect(lost.rivals).toBe(run.rivals)
    expect(startTowerRound(lost)).toBe(lost)
  })

  // UT-249 (Jose, 17/11/2026, PRD §0 «Torre: seguir con el mismo equipo»).
  describe('seguir con el mismo equipo (UT-249)', () => {
    const win = (series: TowerRun) => {
      let current = series
      for (let i = 0; i < current.rivals.length; i += 1) current = finishTowerRound(startTowerRound(current), 'win')
      return current
    }

    it('encadena siete series de 6 líderes y un campeón y una final con los 4 líderes que quedan, sin repetir a nadie', () => {
      const seen: string[] = []
      const seeds = new Set<string>()
      let current = run
      const shapes: string[] = []
      for (;;) {
        expect(current.team).toBe(run.team)
        seen.push(...current.rivals.map(({ trainer }) => trainer.id))
        shapes.push(current.rivals.map(({ trainer }) => trainer.category === 'champion' ? 'C' : 'L').join(''))
        current.rivals.forEach((_, index) => seeds.add(towerBattleSeed({ ...current, index })))
        current = win(current)
        expect(towerBeaten(current)).toBe(seen.length)
        if (towerRemaining(current, data) === 0) break
        current = continueTowerRun(current, data)
        expect([current.phase, current.index, current.series]).toEqual(['between', 0, shapes.length])
      }
      expect(shapes).toEqual([...Array(7).fill('LLLLLLC'), 'LLLL'])
      expect(new Set(seen).size).toBe(seen.length)
      expect(seen).toHaveLength(towerTrainerTotal(data))
      expect(towerTrainerTotal(data)).toBe(53)
      expect(seeds.size).toBe(53)
      expect(continueTowerRun(current, data)).toBe(current)
    })

    it('solo sigue tras ganar; es reproducible y la primera serie conserva sus semillas', () => {
      expect(continueTowerRun(run, data)).toBe(run)
      const won = win(run)
      expect(continueTowerRun(won, data)).toEqual(continueTowerRun(won, data))
      expect(towerBattleSeed({ ...run, index: 2 })).toBe(towerBattleSeed({ ...run, index: 2, series: 0 }))
      const lost = finishTowerRound(startTowerRound(continueTowerRun(won, data)), 'loss')
      expect([lost.phase, towerBeaten(lost)]).toEqual(['lost', 7])
      expect(continueTowerRun(lost, data)).toBe(lost)
    })
  })
})
