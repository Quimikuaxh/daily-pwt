import { describe, it, expect } from 'vitest'
import { createBattleEngine } from './engine'
import { translateLines } from './translate'
import { getDailyChallenge } from '../core/challenge'
import { loadGameData } from '../data/gameData'
import { LAUNCH_DATE } from '../config'
import { dates } from '../test-utils/dates'
import { firstEnabled } from '../test-utils/harness'

// INT-15 · RNF-02: un turno completo (elección del jugador + respuesta de la IA + traducción) < 300 ms (mediana y p95 en 200 turnos).
const data = loadGameData()

function collectTurnTimes(n: number): number[] {
  const times: number[] = []
  for (const date of dates(30, LAUNCH_DATE)) {
    const c = getDailyChallenge(date, data)
    const engine = createBattleEngine({ battleSeed: 'perf-' + date, player: c.playerTeam, rival: c.rivalTeam, ai: 'heuristic', maxTurns: 300 } as any)
    let u = engine.start()
    const ctx = { names: data.names, trainer: { nameEs: c.trainer.nameEs, category: c.trainer.category, gender: 'M' as const } }
    while (!u.ended && times.length < n) {
      const t0 = performance.now()
      u = engine.choose(firstEnabled(u.request!))
      translateLines(u.lines, ctx)
      times.push(performance.now() - t0)
    }
    if (times.length >= n) break
  }
  return times
}

describe('rendimiento de un turno completo (INT-15)', () => {
  const times = collectTurnTimes(200)
  const sorted = [...times].sort((a, b) => a - b)

  it('se miden 200 turnos', () => {
    expect(times).toHaveLength(200)
  })

  it('la mediana es menor de 300 ms', () => {
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(300)
  })

  it('el percentil 95 es menor de 300 ms', () => {
    expect(sorted[Math.floor(sorted.length * 0.95)]).toBeLessThan(300)
  })
})
