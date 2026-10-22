import { describe, it, expect } from 'vitest'
import { deferFaintUntilFaintLine } from './faintOrder'
import { viewReducer } from './viewReducer'
import { mkView, rMon } from '../test-utils/view'

const lethalRival = '|-damage|p2a: Snorlax|0 fnt'
const apply = (before: ReturnType<typeof mkView>, line: string) => deferFaintUntilFaintLine(before, viewReducer(before, { type: 'lines', lines: [line] }), line)

describe('deferFaintUntilFaintLine (DEC-42)', () => {
  it('golpe letal al rival: 0 % de PS pero sigue en pie y el contador no baja hasta |faint|', () => {
    const before = mkView()
    const hit = apply(before, lethalRival)
    expect(hit.rival.team[0]).toMatchObject({ hpPercent: 0, fainted: false })
    expect(hit.rival.remaining).toBe(3)
    const fainted = viewReducer(hit, { type: 'lines', lines: ['|faint|p2a: Snorlax'] })
    expect(fainted.rival.team[0].fainted).toBe(true)
    expect(fainted.rival.remaining).toBe(2)
  })

  it('golpe letal al jugador: 0 PS exactos, en pie hasta |faint|', () => {
    const hit = apply(mkView(), '|-damage|p1a: Garchomp|0 fnt')
    expect(hit.player.team[0]).toMatchObject({ hp: 0, fainted: false })
    expect(viewReducer(hit, { type: 'lines', lines: ['|faint|p1a: Garchomp'] }).player.team[0].fainted).toBe(true)
  })

  it('un golpe no letal o una curación se devuelven sin tocar', () => {
    const before = mkView()
    const line = '|-damage|p2a: Snorlax|40/100'
    const after = viewReducer(before, { type: 'lines', lines: [line] })
    expect(deferFaintUntilFaintLine(before, after, line)).toBe(after)
  })

  it('un Pokémon que ya estaba debilitado no se resucita', () => {
    const before = mkView({ rival: [rMon('snorlax', 0), rMon('tyranitar')] })
    const line = lethalRival
    const after = viewReducer(before, { type: 'lines', lines: [line] })
    expect(deferFaintUntilFaintLine(before, after, line).rival.team[0].fainted).toBe(true)
  })
})

