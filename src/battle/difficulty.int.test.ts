import { describe, it, expect } from 'vitest'
import { createBattleEngine } from './engine'
import { getDailyChallenge } from '../core/challenge'
import { loadGameData } from '../data/gameData'
import { LAUNCH_DATE } from '../config'
import { dates } from '../test-utils/dates'
import { expectedDamage } from '../test-utils/calc'
import { firstEnabled, playOut, speciesOfDetails, type EngineUpdate } from '../test-utils/harness'
import { toId } from '../test-utils/dex'

// INT-14 · decisión 9 de REQUISITOS §2: comprobación PRELIMINAR de dificultad (la calibración con 20 partidas es de F2).
// 50 partidas (10 por rival) con un jugador de "mejor daño esperado". Se INFORMA el porcentaje de victorias por rival y se
// avisa de extremos (<10 % o >95 %), pero NO hay aserción estricta sobre el balance (sí sobre que las partidas terminen).
const data = loadGameData()
const DAYS = dates(5, LAUNCH_DATE)

function bestDamagePolicy(challenge: ReturnType<typeof getDailyChallenge>) {
  const byId = (team: any[], id: string) => team.find((p) => p.species === id)
  return (u: EngineUpdate) => {
    const req = u.request!
    if (req.forceSwitch) return firstEnabled(req)
    const mine = byId(challenge.playerTeam, toId(speciesOfDetails(req.side.pokemon[0].details)))
    const foeView = u.view.rival
    const foe = byId(challenge.rivalTeam, foeView.team[foeView.active].species)
    const moves = req.active![0].moves
    let best = -1, bestSlot = 1
    moves.forEach((m, i) => {
      if (m.disabled) return
      const dmg = mine && foe ? expectedDamage(mine, foe, m.id) : 0
      if (dmg > best) { best = dmg; bestSlot = i + 1 }
    })
    return { type: 'move' as const, slot: bestSlot }
  }
}

describe('dificultad preliminar (INT-14)', () => {
  const results: Record<string, { wins: number; games: number }> = {}

  it('50 partidas (10 por rival) terminan todas', () => {
    for (const date of DAYS) {
      const c = getDailyChallenge(date, data)
      for (let s = 0; s < 10; s++) {
        const engine = createBattleEngine({ battleSeed: `dif-${date}-${s}`, player: c.playerTeam, rival: c.rivalTeam, ai: 'heuristic', maxTurns: 300 } as any)
        const g = playOut(engine as any, bestDamagePolicy(c))
        expect(g.last.ended, `${date}#${s}`).toBeDefined()
        const r = (results[c.trainer.id] ??= { wins: 0, games: 0 })
        r.games++
        if (g.last.ended!.result === 'win') r.wins++
      }
    }
    expect(Object.values(results).reduce((n, r) => n + r.games, 0)).toBe(50)
  }, 600_000)

  it('informa el % de victorias por rival y avisa de extremos (sin aserción estricta)', () => {
    const report = Object.fromEntries(Object.entries(results).map(([id, r]) => [id, `${Math.round((100 * r.wins) / r.games)} %`]))
    console.info('INT-14 victorias del jugador "mejor daño" por rival:', JSON.stringify(report))
    for (const [id, r] of Object.entries(results)) {
      const pct = (100 * r.wins) / r.games
      if (pct < 10 || pct > 95) console.warn(`INT-14 AVISO: ${id} tiene ${pct} % de victorias (extremo)`)
    }
    expect(Object.keys(results).length).toBe(5)
  })
})
