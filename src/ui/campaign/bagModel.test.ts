import { describe, expect, it } from 'vitest'
import { machineItems, machineLabel } from './bagModel'

// UT-209 (Jose, 12/11/2026): MT y MO conseguidas hasta el tramo actual, para el bolsillo MT/MO.
describe('MT/MO de la Mochila', () => {
  it('crecen con los tramos y se nombran como en el juego', () => {
    expect(machineItems({ encounterIndex: 0 }).length).toBeLessThan(machineItems({ encounterIndex: 8 }).length)
    expect(machineItems({ encounterIndex: 8 }).every(({ move }) => move.length > 0)).toBe(true)
    expect(machineLabel('tm05')).toBe('MT05')
    expect(machineLabel('hm03')).toBe('MO03')
  })
})
