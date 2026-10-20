import { describe, it, expect } from 'vitest'
import { fewTypesData, impossibleRf14Data, makeGameData } from './fixtures'

// Comprobación de las propias fixtures (no del código de producción).
describe('fixtures sintéticas', () => {
  it('construyen GameData con todas las especies y movimientos resueltos', () => {
    const d = makeGameData()
    expect(Object.keys(d.dex.species).length).toBeGreaterThan(20)
    expect(d.trainers).toHaveLength(3)
  })
  it('los pools imposibles se construyen', () => {
    expect(impossibleRf14Data().trainers).toHaveLength(1)
    expect(fewTypesData().playerSets).toHaveLength(8)
  })
})
