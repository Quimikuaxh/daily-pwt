import { describe, expect, it } from 'vitest'
import { challengeFor, getDailyChallenge } from './challenge'
import { addDays } from './date'
import { DISTINCT_BASE_SPECIES_FROM } from './launch'
import { loadGameData } from '../data/gameData'

// UT-102 · RF-12b (Jose, 28/10/2026): el equipo del jugador no repite especie aunque sean formas distintas, desde DISTINCT_BASE_SPECIES_FROM.
const data = loadGameData()
const baseOf = (speciesId: string) => data.dex.species[speciesId]?.baseSpecies ?? speciesId
const hasRepeatedBase = (date: string) => {
  const bases = getDailyChallenge(date, data).playerTeam.map((member) => baseOf(member.species))
  return new Set(bases).size !== bases.length
}

describe('sin formas de la misma especie en el equipo (UT-102)', () => {
  it('ningún día en 400 desde DISTINCT_BASE_SPECIES_FROM tiene dos formas de la misma especie', () => {
    const offenders = Array.from({ length: 400 }, (_, offset) => addDays(DISTINCT_BASE_SPECIES_FROM, offset)).filter(hasRepeatedBase)
    expect(offenders).toEqual([])
  })

  it('con todos los rivales y fechas de prueba, tampoco (el pool sí tiene Thundurus, Rotom y sus formas)', () => {
    expect(data.dex.species.thundurustherian.baseSpecies).toBe('thundurus')
    expect(data.dex.species.thundurus.baseSpecies).toBeUndefined()
    const offenders = data.trainers.flatMap((trainer) =>
      Array.from({ length: 20 }, (_, offset) => addDays(DISTINCT_BASE_SPECIES_FROM, offset))
        .map((date) => challengeFor({ date, trainerId: trainer.id }, data))
        .filter((challenge) => new Set(challenge.playerTeam.map((member) => baseOf(member.species))).size !== challenge.playerTeam.length)
        .map((challenge) => `${challenge.date} ${trainer.id}`),
    )
    expect(offenders).toEqual([])
  })
})
