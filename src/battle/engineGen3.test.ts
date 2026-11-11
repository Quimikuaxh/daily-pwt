import { describe, expect, it } from 'vitest'
import { createBattleEngine } from './engine'
import { mon } from '../test-utils/teams'

// UT-178 · Gen 3 (campaña de Hoenn): PP de la generación, sin Más PP; el diario (Gen 5) los conserva.
const team = () => [mon('poochyena', ['tailwhip', 'tackle', 'howl', 'bite'], { ability: 'runaway', level: 15 } as never)]
const engine = (generation: 3 | 5) => createBattleEngine({ battleSeed: 'ut178', generation, player: team(), playerLead: 0, rival: team(), ai: 'trivial', maxTurns: 50 } as never)

describe('PP en Gen 3', () => {
  it('el primer turno ya llega con los PP base (LÁTIGO 30, PLACAJE 35) y al usarlo gasta de ahí', () => {
    const battle = engine(3)
    const moves = battle.start().request!.active![0].moves
    expect(moves.map((move) => [move.id, move.pp, move.maxpp])).toEqual([['tailwhip', 30, 30], ['tackle', 35, 35], ['howl', 40, 40], ['bite', 25, 25]])
    const after = battle.choose({ type: 'move', slot: 1 })
    expect(after.request?.active?.[0].moves[0]).toMatchObject({ pp: 29, maxpp: 30 })
  })

  it('el reto diario (Gen 5) sigue con los Más PP del simulador', () => {
    expect(engine(5).start().request!.active![0].moves[0]).toMatchObject({ id: 'tailwhip', maxpp: 48 })
  })
})
