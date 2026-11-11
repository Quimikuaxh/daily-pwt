import { describe, expect, it } from 'vitest'
import { Prng } from '../core/prng'
import { mkMon, mkState, rs } from '../test-utils/ai'
import { chooseRivalAction } from './ai/heuristic'
import { moveInfo, typeMultiplier } from './ai/moveInfo'
import { computeDamage } from './damage'
import { createBattleEngine } from './engine'
import type { BattleSet } from './protocol'

describe('combate individual de tercera generación', () => {
  const alakazam = rs('alakazam', '', 'synchronize', ['shadowball', 'thunderpunch', 'recover', 'protect'])
  const mew = rs('mew', '', 'synchronize', ['splash', 'protect', 'rest', 'tackle'])

  it('conserva el nivel y un único movimiento en equipos sin objeto y de tamaños distintos', () => {
    const player: BattleSet = { ...mew, level: 12, moves: ['splash'] }
    const rival: BattleSet = { ...alakazam, level: 15, moves: ['shadowball'] }
    const engine = createBattleEngine({
      generation: 3,
      battleSeed: 'emerald',
      player: [player],
      rival: [rival, mew],
      ai: 'heuristic',
      maxTurns: 10,
    })
    const start = engine.start()
    expect(start.request?.side.pokemon[0].details).toContain('L12')
    expect(start.lines).toContain('|gen|3')
    expect(start.request?.active?.[0].moves.map(move => move.id)).toEqual(['splash'])
    expect(start.view.player.team[0].item).toBe('')
    expect(start.view.rival.team).toHaveLength(2)
    expect(start.view.rival.team[0].moves?.map(move => move.id)).toEqual(['shadowball'])
    expect(engine.choose({ type: 'move', slot: 1 }).view.turn).toBe(2)
  })

  it('lee la categoría por tipo en Gen 3 sin contaminar la caché de Gen 5', () => {
    expect(moveInfo('shadowball').category).toBe('Special')
    expect(moveInfo('shadowball', 3).category).toBe('Physical')
    expect(moveInfo('thunderpunch', 3).category).toBe('Special')
    expect(moveInfo('thunderpunch').category).toBe('Physical')
    expect(typeMultiplier('Electric', 'rhydon', 3)).toBe(0)
  })

  it('estima Poder Oculto Lucha con la potencia 30 de los IV del atacante', () => {
    for (const move of ['hiddenpower', 'hiddenpowerfighting']) {
      const damage = computeDamage({ set: alakazam }, { set: mew }, move, { generation: 3 })
      expect([damage.min, damage.max]).toEqual([3, 4])
    }
  })

  it('estima el daño con la generación del combate al elegir un ataque', () => {
    const state = mkState([mkMon(alakazam)], [mkMon(mew)])
    expect(chooseRivalAction(state, new Prng('damage'))).toEqual({ type: 'move', slot: 1 })
    expect(chooseRivalAction({ ...state, generation: 3 }, new Prng('damage'))).toEqual({ type: 'move', slot: 2 })
  })
})
