import { describe, expect, it } from 'vitest'
import { TYPE_CHART } from '../../../core/typeChart'
import { effectivenessTone, moveEffectiveness, statsWithBoosts } from './sideModel'

// UT-152 · Paneles laterales (RF-44c, DEC-81): eficacia contra el de enfrente (con habilidad y objeto) y estadísticas con sus subidas.
const target = (types: string[], abilityId = '', itemId = '') => ({ types: types.map((id) => ({ id, label: id })), abilityId, itemId })
const move = (id: string, typeName: string, category: 'Physical' | 'Special' | 'Status' = 'Physical') => ({ id, typeName, category })

describe('eficacia del movimiento (UT-152)', () => {
  it('por tipos: ×4, ×2, ×1, ×½, ×¼ y ×0', () => {
    expect(moveEffectiveness(move('rockslide', 'Rock'), target(['Fire', 'Flying']), '', TYPE_CHART)).toBe(4)
    expect(moveEffectiveness(move('hydropump', 'Water', 'Special'), target(['Fire']), '', TYPE_CHART)).toBe(2)
    expect(moveEffectiveness(move('shadowball', 'Ghost', 'Special'), target(['Fire']), '', TYPE_CHART)).toBe(1)
    expect(moveEffectiveness(move('flareblitz', 'Fire'), target(['Fire']), '', TYPE_CHART)).toBe(0.5)
    expect(moveEffectiveness(move('energyball', 'Grass', 'Special'), target(['Fire', 'Dragon']), '', TYPE_CHART)).toBe(0.25)
    expect(moveEffectiveness(move('earthquake', 'Ground'), target(['Flying']), '', TYPE_CHART)).toBe(0)
  })

  it('los de estado no tienen eficacia', () => {
    expect(moveEffectiveness(move('willowisp', 'Fire', 'Status'), target(['Grass']), '', TYPE_CHART)).toBeNull()
  })

  it('cuenta la habilidad y el objeto del que recibe (Levitación, Absorbe Fuego, Superguarda, Globo, Bola Férrea)', () => {
    // El Rotom de Blaine: por tipos, Terremoto le haría ×4.
    expect(moveEffectiveness(move('earthquake', 'Ground'), target(['Electric', 'Fire'], 'levitate'), '', TYPE_CHART)).toBe(0)
    expect(moveEffectiveness(move('flamethrower', 'Fire', 'Special'), target(['Fire'], 'flashfire'), '', TYPE_CHART)).toBe(0)
    expect(moveEffectiveness(move('shadowball', 'Ghost', 'Special'), target(['Bug', 'Ghost'], 'wonderguard'), '', TYPE_CHART)).toBe(2)
    expect(moveEffectiveness(move('xscissor', 'Bug'), target(['Bug', 'Ghost'], 'wonderguard'), '', TYPE_CHART)).toBe(0)
    expect(moveEffectiveness(move('earthquake', 'Ground'), target(['Steel'], '', 'airballoon'), '', TYPE_CHART)).toBe(0)
    expect(moveEffectiveness(move('earthquake', 'Ground'), target(['Flying', 'Steel'], '', 'ironball'), '', TYPE_CHART)).toBe(2)
  })

  it('Rompemoldes ignora la habilidad; Intrépido alcanza a los Fantasma', () => {
    expect(moveEffectiveness(move('earthquake', 'Ground'), target(['Electric', 'Fire'], 'levitate'), 'moldbreaker', TYPE_CHART)).toBe(4)
    expect(moveEffectiveness(move('closecombat', 'Fighting'), target(['Ghost', 'Dark']), 'scrappy', TYPE_CHART)).toBe(2)
  })

  it('daño fijo: solo si le afecta', () => {
    expect(moveEffectiveness(move('seismictoss', 'Fighting'), target(['Rock', 'Steel']), '', TYPE_CHART)).toBe(1)
    expect(moveEffectiveness(move('seismictoss', 'Fighting'), target(['Ghost']), '', TYPE_CHART)).toBe(0)
  })

  it('tono de la franja', () => {
    expect([4, 2, 1, 0.5, 0.25, 0].map(effectivenessTone)).toEqual(['x4', 'x2', 'x1', 'xh', 'xq', 'x0'])
  })
})

describe('estadísticas con subidas y bajadas (UT-152)', () => {
  // Cambio de requisito (Jose, 05/11/2026): el valor es el original; la subida o bajada va aparte, con su nivel.
  it('el valor original y el nivel de cada una; los PS nunca cambian', () => {
    const stats = { hp: 130, atk: 80, def: 75, spa: 145, spd: 90, spe: 125 }
    expect(statsWithBoosts(stats, { spa: 1, spe: -2 }).map((stat) => [stat.key, stat.value, stat.stage])).toEqual([
      ['hp', 130, 0],
      ['atk', 80, 0],
      ['def', 75, 0],
      ['spa', 145, 1],
      ['spd', 90, 0],
      ['spe', 125, -2],
    ])
    expect(statsWithBoosts(stats, null).map((stat) => stat.stage)).toEqual([0, 0, 0, 0, 0, 0])
  })
})
