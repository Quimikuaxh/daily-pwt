import { describe, it, expect } from 'vitest'
import { createBattleEngine } from './engine'
import { filler, harmlessTeam, mon, withLead } from '../test-utils/teams'

// Revisión ciclo 1: ante una captura oculta (Magnet Pull) el sim rechaza el cambio; el motor devuelve la nueva petición en vez de lanzar.
const skarmory = mon('skarmory', ['splash', 'tackle', 'recover', 'protect'], { ability: 'keeneye' })
const magnezone = mon('magnezone', ['splash', 'tackle', 'recover', 'protect'], { ability: 'magnetpull' })

function make() {
  return createBattleEngine({
    battleSeed: 'seed-trap', player: [skarmory, filler('blissey'), filler('snorlax'), filler('wobbuffet'), filler('chansey'), filler('slowbro')],
    rival: withLead(magnezone), ai: 'trivial', maxTurns: 300,
  } as any)
}

describe('maybeTrapped (Magnet Pull)', () => {
  it('precondición: el request avisa de que puede estar atrapado', () => {
    expect(make().start().request!.active![0].maybeTrapped).toBe(true)
  })

  it('un cambio rechazado por la captura no lanza y devuelve una petición nueva con trapped', () => {
    const engine = make()
    engine.start()
    const update = engine.choose({ type: 'switch', slot: 2 })
    expect([update.request!.active![0].trapped, update.ended]).toEqual([true, undefined])
  })

  it('el turno no avanza y se puede elegir un movimiento después', () => {
    const engine = make()
    const first = engine.start()
    const rejected = engine.choose({ type: 'switch', slot: 2 })
    expect(rejected.view.turn).toBe(first.view.turn)
    expect(engine.choose({ type: 'move', slot: 2 }).view.turn).toBe(first.view.turn + 1)
  })

  it('un cambio inválido sin captura posible sigue lanzando', () => {
    const engine = createBattleEngine({ battleSeed: 's', player: harmlessTeam(), rival: harmlessTeam(), ai: 'trivial', maxTurns: 300 } as any)
    engine.start()
    expect(() => engine.choose({ type: 'switch', slot: 1 })).toThrow()
  })
})
