import { describe, expect, it } from 'vitest'
import { usedMove } from './useBattle'

// UT-70 · Qué movimiento se anima y quién lo usa (DEC-53).
describe('usedMove', () => {
  it('jugador y rival', () => {
    expect(usedMove('|move|p1a: Politoed|Ice Beam|p2a: Zebstrika')).toEqual({ moveId: 'icebeam', user: 'player' })
    expect(usedMove('|move|p2a: Zebstrika|Wild Charge|p1a: Politoed')).toEqual({ moveId: 'wildcharge', user: 'rival' })
  })

  it('no se anima si falla, si es el turno de carga o si no hay objetivo', () => {
    expect(usedMove('|move|p1a: Politoed|Hydro Pump|p2a: Zebstrika|[miss]')).toBeNull()
    expect(usedMove('|move|p1a: Politoed|Solar Beam||[still]')).toBeNull()
    expect(usedMove('|move|p1a: Politoed|Tackle||[notarget]')).toBeNull()
  })

  it('las demás líneas no son movimientos', () => {
    expect(usedMove('|-damage|p2a: Zebstrika|50/100')).toBeNull()
    expect(usedMove('|turn|3')).toBeNull()
  })
})
