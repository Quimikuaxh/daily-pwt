import { describe, expect, it } from 'vitest'
import { draftOffer, draftPool, type DraftRequest } from './draft'

const request: DraftRequest = {
  seed: 'campaña',
  encounterId: 'petra',
  pick: 0,
  rivalAverage: 300,
  window: { below: 20, above: 20 },
  previousOffer: [],
  candidates: [
    { species: 'a', baseStatTotal: 280 },
    { species: 'b', baseStatTotal: 320 },
    { species: 'c', baseStatTotal: 300 },
    { species: 'd', baseStatTotal: 310 },
    { species: 'e', baseStatTotal: 299 },
    { species: 'weak', baseStatTotal: 279 },
    { species: 'strong', baseStatTotal: 321 },
  ],
}

describe('draft Nuzlocke', () => {
  it('sortea cuatro formas distintas dentro de un margen inclusivo', () => {
    const candidates = request.candidates.filter(candidate => candidate.species !== 'e')
    expect(draftOffer({ ...request, candidates: [...candidates, candidates[0]] }).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('repite la misma oferta al reanudar aunque cambie el orden de entrada', () => {
    expect(draftOffer(request)).toEqual(draftOffer({ ...request, candidates: [...request.candidates].reverse() }))
  })

  it('excluye los candidatos de la oferta anterior', () => {
    expect(draftOffer({ ...request, pick: 1, previousOffer: ['e'] }).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('avisa si no se puede formar una oferta válida', () => {
    expect(() => draftOffer({ ...request, previousOffer: ['a', 'b'] })).toThrow(/cuatro candidatos/i)
  })

  it('expone el pool único con límites inclusivos y exclusiones antes de sortear', () => {
    expect(draftPool({ ...request, candidates: [...request.candidates, request.candidates[0]], previousOffer: ['e'] })).toEqual(['a', 'b', 'c', 'd'])
  })

  it('garantiza el candidato requerido con semillas y órdenes de entrada distintos', () => {
    for (let index = 0; index < 50; index++) {
      const input = { ...request, seed: String(index), requiredSpecies: ['e'] }
      const offer = draftOffer(input)
      expect(new Set(offer).size).toBe(4)
      expect(offer).toContain('e')
      expect(draftOffer({ ...input, candidates: [...input.candidates].reverse() })).toEqual(offer)
    }
  })

  it('no relaja el margen ni la exclusión para satisfacer el tipo', () => {
    expect(() => draftOffer({ ...request, requiredSpecies: ['weak'] })).toThrow(/supereficaz/)
    expect(() => draftOffer({ ...request, requiredSpecies: ['e'], previousOffer: ['e'] })).toThrow(/supereficaz/)
  })

  it('permite que todos los candidatos sean requeridos y no inventa un requisito ausente', () => {
    const candidates = request.candidates.slice(0, 4)
    expect(draftOffer({ ...request, candidates, requiredSpecies: candidates.map(c => c.species) }).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(draftOffer(request)).toEqual(draftOffer({ ...request, requiredSpecies: undefined }))
  })
})
