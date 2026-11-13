import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Dex } from '@pkmn/dex'
import { importScript } from '../src/test-utils/paths'

const { N2B2_PROGRESSION, evolutionOf, validateN2b2Progression } = await importScript('scripts/build-n2b2-progression.mjs')
const species = (id: string) => Dex.forGen(5).species.get(id)

// Progresión de la locke de N2/B2 (PRD §0, 13/11/2026): datos de Gen 5 de @pkmn/dex con los métodos de evolución de Hoenn y los de Gen 5.
describe('progresión de N2/B2', () => {
  it('traduce cada forma de evolución de Gen 5 e ignora los objetos de juegos posteriores', () => {
    expect(evolutionOf(species('gallade'))).toEqual({ method: 'ITEM_MALE', parameter: 'dawnstone', target: 'gallade' })
    expect(evolutionOf(species('nidoking'))).toEqual({ method: 'ITEM', parameter: 'moonstone', target: 'nidoking' })
    expect(evolutionOf(species('vespiquen'))).toEqual({ method: 'LEVEL_FEMALE', parameter: 21, target: 'vespiquen' })
    expect(evolutionOf(species('leafeon'))).toEqual({ method: 'LOCATION', parameter: 'moss', target: 'leafeon' })
    expect(evolutionOf(species('magnezone'))).toEqual({ method: 'LOCATION', parameter: 'magnetic', target: 'magnezone' })
    expect(evolutionOf(species('weavile'))).toEqual({ method: 'LEVEL_ITEM_NIGHT', parameter: 'razorclaw', target: 'weavile' })
    expect(evolutionOf(species('ambipom'))).toEqual({ method: 'LEVEL_MOVE', parameter: 'doublehit', target: 'ambipom' })
    expect(evolutionOf(species('escavalier'))).toEqual({ method: 'TRADE_SPECIES', parameter: 'shelmet', target: 'escavalier' })
    expect(evolutionOf(species('milotic'))).toEqual({ method: 'TRADE_ITEM', parameter: 'prismscale', target: 'milotic' })
    expect(evolutionOf(species('shedinja')).method).toBe('LEVEL_SHEDINJA')
  })

  it('el fichero versionado tiene las 649 especies, las 101 MT/MO y evoluciones a especies presentes', () => {
    const progression = JSON.parse(readFileSync(N2B2_PROGRESSION, 'utf8'))
    expect(() => validateN2b2Progression(progression)).not.toThrow()
    expect(progression.species.snivy.evolutions).toEqual([{ method: 'LEVEL', parameter: 17, target: 'servine' }])
    expect(progression.species.clefairy.types).toEqual(['Normal'])
    expect(progression.machines.tm83).toBe('workup')
  })
})
