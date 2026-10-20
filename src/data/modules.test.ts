import { describe, it, expect } from 'vitest'
import { DataError } from '../core/errors'
import { loadGameData } from './gameData'
import { nameEs } from './names'
import { poolWithoutRival } from './pool'
import { pokemonSpriteUrl, trainerMiniSpriteUrl, trainerSpriteUrl } from './sprites'
import { validateGameData } from './validation'

// Módulos auxiliares de src/data (no cubiertos por el plan de pruebas original).
const data = loadGameData()

describe('validateGameData', () => {
  it('los datos reales no tienen problemas de forma', () => {
    expect(validateGameData(data)).toEqual([])
  })

  it('detecta una variante con 5 Pokémon y un lead ausente', () => {
    const broken = structuredClone(data)
    broken.trainers[0].variants[0].team.pop()
    broken.trainers[0].alwaysLeadsWith = 'mewtwo'
    const problems = validateGameData(broken)
    expect(problems.some((p) => p.includes('no tiene 6 Pokémon'))).toBe(true)
    expect(problems.some((p) => p.includes('alwaysLeadsWith'))).toBe(true)
  })

  it('detecta un nombre en español ausente y un entrenador desconocido en el calendario', () => {
    const broken = structuredClone(data)
    delete broken.names.items.leftovers
    broken.rosterSchedule[0].trainerIds.push('nadie')
    const problems = validateGameData(broken)
    expect(problems.some((p) => p.includes('leftovers') || p.includes('objeto'))).toBe(true)
    expect(problems.some((p) => p.includes('nadie'))).toBe(true)
  })
})

describe('nameEs', () => {
  it('resuelve un nombre y lanza DataError si falta', () => {
    expect(nameEs(data.names, 'moves', 'earthquake')).toBe('Terremoto')
    expect(() => nameEs(data.names, 'moves', 'noexiste')).toThrow(DataError)
  })
})

describe('sprites', () => {
  it('construye las rutas de public/sprites', () => {
    expect(pokemonSpriteUrl(data.dex, 'onix', 'back')).toBe('/sprites/pokemon/back/onix.gif')
    expect(trainerSpriteUrl('brock')).toBe('/sprites/trainers/brock.gif')
    expect(trainerMiniSpriteUrl('brock', './')).toBe('./sprites/trainers/brock-mini.png')
  })
})

describe('poolWithoutRival', () => {
  it('quita los sets con tag source:<rival>', () => {
    const filtered = poolWithoutRival(data.playerSets, 'misty')
    expect(filtered.length).toBeLessThan(data.playerSets.length)
    expect(filtered.some((set) => set.tags?.includes('source:misty'))).toBe(false)
  })
})
