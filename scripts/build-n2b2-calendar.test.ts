import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importScript } from '../src/test-utils/paths'

const { N2B2_CALENDAR, parseTmhm, placeOf, validateN2b2Calendar } = await importScript('scripts/build-n2b2-calendar.mjs')

// Calendario de MT/MO de la locke de N2/B2 (PRD §0, 13/11/2026): ubicación de Serebii, tramo según la guía de WikiDex por medallas.
describe('calendario de N2/B2', () => {
  it('lee número, ataque y ubicación de cada MT/MO una sola vez', () => {
    const row = (id: string, move: string, location: string) => `<tr><td>${id}</td><td>${move}</td><td>--</td><td>--</td><td>15</td><td>x</td><td>${location}</td></tr>`
    const html = row('TM83', 'Work Up', 'Aspertia City - Defeat Cheren') + row('TM83', 'Work Up', 'otra') + row('HM01', 'Cut', 'Virbank City - From Roxie')
    expect(parseTmhm(html)).toEqual([
      { id: 'tm83', move: 'Work Up', location: 'Aspertia City - Defeat Cheren' },
      { id: 'hm01', move: 'Cut', location: 'Virbank City - From Roxie' },
    ])
  })

  it('un premio de líder cuenta desde el tramo siguiente; la PWT y lo de después de la Liga quedan fuera; una zona nueva falla', () => {
    expect(placeOf('Aspertia City - Defeat Cheren')).toEqual({ before: 'hiedra' })
    expect(placeOf('Floccesy Ranch')).toEqual({ before: 'cheren' })
    expect(placeOf('Humilau City - Defeat Marlon')).toEqual({ before: 'anis' })
    expect(placeOf('Pokémon World Tournament').excluded).toMatch(/PWT/)
    expect(placeOf('Twist Mountain').excluded).toMatch(/Liga/)
    expect(() => placeOf('Pueblo Inventado')).toThrow(/sin tramo/)
  })

  it('el calendario versionado tiene las 101 MT/MO una vez, con hitos y ataques válidos', () => {
    const calendar = JSON.parse(readFileSync(N2B2_CALENDAR, 'utf8'))
    expect(() => validateN2b2Calendar(calendar)).not.toThrow()
    expect(calendar.machines.tm83.before).toBe('hiedra')
    expect(calendar.excluded.tm26.reason).toMatch(/Liga/)
  })
})
