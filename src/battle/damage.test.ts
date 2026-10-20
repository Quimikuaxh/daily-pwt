import { describe, it, expect } from 'vitest'
import { computeDamage, damageOrZero } from './damage'
import { damageRange, maxHpOf } from '../test-utils/calc'
import { mkResolved } from '../test-utils/fixtures'

const garchomp = mkResolved('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'])
const heatran = mkResolved('heatran', 'leftovers', 'flashfire', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock'])

describe('computeDamage / damageOrZero (IA)', () => {
  it('los PS actuales y los cambios de característica del atacante cuentan', () => {
    const base = computeDamage({ set: garchomp }, { set: heatran }, 'outrage')
    const boosted = computeDamage({ set: garchomp, boosts: { atk: 2 } }, { set: heatran }, 'outrage')
    expect(boosted.max).toBeGreaterThan(base.max)
  })

  it('una quemadura reduce el daño físico', () => {
    const base = computeDamage({ set: garchomp }, { set: heatran }, 'outrage')
    const burned = computeDamage({ set: garchomp, status: 'brn' }, { set: heatran }, 'outrage')
    expect(burned.max).toBeLessThan(base.max)
  })

  it('damageOrZero devuelve daño nulo si el cálculo es imposible', () => {
    expect(damageOrZero({ set: garchomp }, { set: heatran }, 'movimientoinventado')).toMatchObject({ min: 0, max: 0 })
  })
})
