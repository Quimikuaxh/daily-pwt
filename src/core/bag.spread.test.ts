import { describe, it, expect } from 'vitest'
import { rivalForDay, SPREAD_RULES, type TrainerTraits } from './bag'
import { loadGameData } from '../data/gameData'
import { LAUNCH_OPENING } from './launch'

// UT-88 · DEC-62 (Jose, 27/10/2026): reparto de campeones, regiones y hermanos sobre la bolsa, con los datos reales.
const data = loadGameData()
const traits: TrainerTraits = Object.fromEntries(data.trainers.map((t) => [t.id, { champion: t.category === 'champion', region: t.region }]))
const schedule = data.rosterSchedule
const n = schedule[0].trainerIds.length
const CYCLES = 40
const days = Array.from({ length: n * CYCLES }, (_, day) => rivalForDay(day, schedule, LAUNCH_OPENING, traits))

describe('reparto de la bolsa (UT-88)', () => {
  it('cada ciclo es una permutación del roster y los cuatro primeros días son los publicados', () => {
    for (let c = 0; c < CYCLES; c++) expect([...days.slice(c * n, (c + 1) * n)].sort()).toEqual([...schedule[0].trainerIds].sort())
    expect(days.slice(0, 4)).toEqual(['misty', 'fredo', 'anton', 'mirto'])
  })

  it(`entre dos campeones hay al menos ${SPREAD_RULES.minChampionGap} días, también entre ciclos`, () => {
    const at = days.flatMap((id, day) => (traits[id].champion ? [day] : []))
    const gaps = at.slice(1).map((day, k) => day - at[k])
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(SPREAD_RULES.minChampionGap)
  })

  it(`Millo, Maíz y Zeo salen separados al menos ${SPREAD_RULES.minSiblingGap} días`, () => {
    for (const group of SPREAD_RULES.siblings) {
      const at = days.flatMap((id, day) => (group.includes(id) ? [day] : []))
      const gaps = at.slice(1).map((day, k) => day - at[k])
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(SPREAD_RULES.minSiblingGap)
    }
  })

  it('nunca salen dos de la misma región seguidos (salvo los días ya publicados)', () => {
    const clashes = days.flatMap((id, day) =>
      day > 0 && traits[id].region !== null && traits[id].region === traits[days[day - 1]].region ? [`${day}:${days[day - 1]}-${id}`] : [],
    )
    expect(clashes).toEqual(['2:fredo-anton'])
  })

  it('es determinista y sin rasgos la bolsa es la de siempre', () => {
    expect(Array.from({ length: n * 3 }, (_, day) => rivalForDay(day, schedule, LAUNCH_OPENING, { ...traits }))).toEqual(days.slice(0, n * 3))
    expect(rivalForDay(10, schedule, LAUNCH_OPENING)).toBeTypeOf('string')
  })
})
