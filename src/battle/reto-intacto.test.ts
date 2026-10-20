import { describe, it, expect } from 'vitest'
import { createBattleEngine } from './engine'
import { getDailyChallenge } from '../core/challenge'
import { loadGameData } from '../data/gameData'
import { firstEnabled, playOut } from '../test-utils/harness'

// INT-03 · RF-43: el PRNG del combate es independiente del reto y nuevo en cada combate.
const data = loadGameData()
const date = '2026-10-18'
const play = (seed: string) => {
  const c = getDailyChallenge(date, data)
  return playOut(createBattleEngine({ battleSeed: seed, player: c.playerTeam, rival: c.rivalTeam, ai: 'heuristic', maxTurns: 300 } as any) as any, (u) => firstEnabled(u.request!))
}

describe('reto vs combate', () => {
  it('el reto no cambia tras correr partidas', () => {
    const before = JSON.stringify(getDailyChallenge(date, data))
    play('a'); play('b')
    expect(JSON.stringify(getDailyChallenge(date, data))).toBe(before)
  })

  it('dos combates del mismo reto con distinta semilla difieren', () => {
    expect(play('combate-1').lines.join('\n')).not.toBe(play('combate-2').lines.join('\n'))
  })

  it('el motor no modifica los equipos que recibe', () => {
    const c = getDailyChallenge(date, data)
    const snap = JSON.stringify([c.playerTeam, c.rivalTeam])
    playOut(createBattleEngine({ battleSeed: 'x', player: c.playerTeam, rival: c.rivalTeam, ai: 'trivial', maxTurns: 300 } as any) as any)
    expect(JSON.stringify([c.playerTeam, c.rivalTeam])).toBe(snap)
  })
})
