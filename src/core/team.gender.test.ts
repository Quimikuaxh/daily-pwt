import { describe, expect, it } from 'vitest'
import { getDailyChallenge } from './challenge'
import { GENDERS_FROM } from './launch'
import { Prng } from './prng'
import { withGenders } from './team'
import { loadGameData } from '../data/gameData'
import { addDays } from '../test-utils/dates'
import type { ResolvedSet } from './types'

// UT-135 · Géneros (Jose, 03/11/2026): con la proporción de la especie, sin género los que no tienen, desde GENDERS_FROM.
const data = loadGameData()
const set = (species: string, gender?: 'M' | 'F') => ({ species, ...(gender ? { gender } : {}) }) as ResolvedSet

describe('withGenders', () => {
  it('sin género (Metagross), ninguno; de un solo género, siempre ese; uno fijado en los datos se respeta', () => {
    const team = withGenders([set('metagross'), set('chansey'), set('tauros'), set('gardevoir', 'F')], data.dex, new Prng('x'))
    expect(team.map((member) => member.gender)).toEqual([undefined, 'F', 'M', 'F'])
  })

  it('sigue la proporción de la especie (Bulbasaur, 7 de cada 8 machos) y es determinista', () => {
    const rng = new Prng('reparto')
    const genders = Array.from({ length: 4000 }, () => withGenders([set('bulbasaur')], data.dex, rng)[0].gender)
    const males = genders.filter((gender) => gender === 'M').length / genders.length
    expect(males).toBeGreaterThan(0.84)
    expect(males).toBeLessThan(0.91)
    expect(withGenders([set('gardevoir'), set('bulbasaur')], data.dex, new Prng('a'))).toEqual(withGenders([set('gardevoir'), set('bulbasaur')], data.dex, new Prng('a')))
  })
})

describe('géneros en el reto', () => {
  it('antes de GENDERS_FROM nadie tiene género; desde ese día, todos los que pueden (el snapshot comprueba que lo demás no cambia)', () => {
    const before = getDailyChallenge(addDays(GENDERS_FROM, -1), data)
    expect([...before.playerTeam, ...before.rivalTeam].every((member) => member.gender === undefined)).toBe(true)
    for (let offset = 0; offset < 30; offset++) {
      const challenge = getDailyChallenge(addDays(GENDERS_FROM, offset), data)
      for (const member of [...challenge.playerTeam, ...challenge.rivalTeam]) {
        const ratio = data.dex.species[member.species].maleRatio
        if (ratio === null) expect(member.gender, member.species).toBeUndefined()
        else expect(member.gender, member.species).toBe(ratio === 1 ? 'M' : ratio === 0 ? 'F' : member.gender ?? 'falta')
      }
    }
  })
})
