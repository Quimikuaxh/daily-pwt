import { describe, it, expect } from 'vitest'
import { Dex } from '@pkmn/dex'
import { Generations } from '@pkmn/data'
import { TYPE_CHART, typeEffectiveness, GEN5_TYPES } from './typeChart'

// UT-07 · RF-14. TODO-CONTRATO: exports TYPE_CHART[atk][def], typeEffectiveness(moveType, defTypes[]), GEN5_TYPES.
const gen5 = new Generations(Dex).get(5)
const REAL = [...gen5.types].map((t) => t.name)

describe('tabla de tipos Gen 5', () => {
  it('tiene exactamente los 17 tipos de Gen 5', () => {
    expect([...GEN5_TYPES].sort()).toEqual([...REAL].sort())
  })

  it('no contiene Hada', () => {
    expect(GEN5_TYPES).not.toContain('Fairy')
  })

  it('coincide celda a celda con @pkmn/data Gen 5', () => {
    const diffs: string[] = []
    for (const atk of REAL) for (const def of REAL) {
      const expected = (gen5.types.get(atk) as any).effectiveness[def]
      if (TYPE_CHART[atk]?.[def] !== expected) diffs.push(`${atk}->${def}: ${TYPE_CHART[atk]?.[def]} != ${expected}`)
    }
    expect(diffs).toEqual([])
  })

  it('Acero resiste Fantasma (Gen 5)', () => {
    expect(typeEffectiveness('Ghost', ['Steel'], TYPE_CHART)).toBe(0.5)
  })

  it('Acero resiste Siniestro (Gen 5)', () => {
    expect(typeEffectiveness('Dark', ['Steel'], TYPE_CHART)).toBe(0.5)
  })

  it('Tierra no afecta a Volador', () => {
    expect(typeEffectiveness('Ground', ['Flying'], TYPE_CHART)).toBe(0)
  })

  it('multiplica los dos tipos del defensor (Hielo vs Dragón/Volador = x4)', () => {
    expect(typeEffectiveness('Ice', ['Dragon', 'Flying'], TYPE_CHART)).toBe(4)
  })

  it('un solo tipo defensor funciona', () => {
    expect(typeEffectiveness('Water', ['Fire'], TYPE_CHART)).toBe(2)
  })

  it('tipo neutral devuelve 1', () => {
    expect(typeEffectiveness('Normal', ['Water'], TYPE_CHART)).toBe(1)
  })

  it('inmunidad gana sobre debilidad en doble tipo (Tierra vs Volador/Eléctrico = 0)', () => {
    expect(typeEffectiveness('Ground', ['Electric', 'Flying'], TYPE_CHART)).toBe(0)
  })
})
