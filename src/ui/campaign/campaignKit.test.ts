import { describe, expect, it } from 'vitest'
import { rulesOf } from '../../core/nuzlocke/rules'
import { hoennKit, unovaKit } from './campaignKit'

// DEC-103: cada campaña aporta su kit; el recorrido de la pantalla es el mismo.
describe('kits de campaña', () => {
  it('Hoenn y Teselia traen sus encuentros, sus reglas y su definición', () => {
    expect(hoennKit.encounters).toHaveLength(13)
    expect(unovaKit.encounters.map((encounter) => encounter.id).slice(0, 2)).toEqual(['cheren', 'hiedra'])
    expect(rulesOf(hoennKit.definition)?.id).toBe('hoenn-emerald')
    expect(rulesOf(unovaKit.definition)?.id).toBe('unova-n2b2')
    expect(Object.keys(unovaKit.definition.species)).toHaveLength(649)
  })

  it('los rivales hablan con su género y los movimientos tienen descripción en su campaña', () => {
    const iris = unovaKit.encounters.at(-1)!
    expect(unovaKit.trainerOf(iris)).toEqual({ nameEs: 'Iris', category: 'champion', gender: 'F' })
    expect(hoennKit.trainerOf(hoennKit.encounters[0]).gender).toBe('F')
    expect(unovaKit.moveDescription('scald')).not.toBe('')
    expect(hoennKit.moveDescription('tackle')).not.toBe('')
  })
})
