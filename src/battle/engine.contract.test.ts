import { describe, it, expect, vi, afterEach } from 'vitest'
import { createBattleEngine } from './engine'
import { attackers, harmlessTeam } from '../test-utils/teams'
import { playOut } from '../test-utils/harness'

// Garantías del motor que no cubre engine.test.ts.
afterEach(() => vi.useRealTimers())

const play = () => playOut(createBattleEngine({ battleSeed: 'contract', player: attackers(), rival: attackers().reverse(), ai: 'heuristic', maxTurns: 300 }))

describe('contrato del motor', () => {
  it('el log no depende de la hora: el sim escribe |t:| con la hora real y el motor lo descarta', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 17, 10, 0, 0))
    const first = play().lines
    vi.setSystemTime(new Date(2026, 9, 17, 10, 0, 7))
    const second = play().lines
    expect(second).toEqual(first)
    expect(first.filter((line) => line.startsWith('|t:|'))).toEqual([])
  })

  it('un inicial fuera del equipo se rechaza', () => {
    const init = { battleSeed: 's', player: harmlessTeam(), rival: harmlessTeam(), ai: 'trivial' as const, maxTurns: 300 }
    expect(() => createBattleEngine({ ...init, playerLead: 6 })).toThrow(/inicial/)
    expect(() => createBattleEngine({ ...init, playerLead: -1 })).toThrow(/inicial/)
  })

  it('la vista del rival nunca lleva PS absolutos, ni siquiera tras recibir daño', () => {
    const { updates } = play()
    const leaks = updates.flatMap((u) => u.view.rival.team).filter((mon) => 'hp' in mon || 'maxHp' in mon)
    expect(leaks).toEqual([])
  })

  it('las peticiones entregadas son copias: modificarlas no altera el combate', () => {
    const engine = createBattleEngine({ battleSeed: 's', player: harmlessTeam(), rival: harmlessTeam(), ai: 'trivial', maxTurns: 300 })
    engine.start().request!.active![0].moves[0].disabled = true
    expect(() => engine.choose({ type: 'move', slot: 1 })).not.toThrow()
  })
})
