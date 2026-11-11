import { describe, expect, it } from 'vitest'
import { loadGameData } from '../../data/gameData'
import { campaignDefinition } from '../../test-utils/campaignUi'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { candidateNotes, candidateOf, statAt, wrapText } from './draftModel'

const data = loadGameData()

describe('modelo del Draft', () => {
  it.each([
    [45, 15, true, 41], [49, 15, false, 22], [100, 50, true, 170],
    [100, 50, false, 115], [80, 1, false, 6], [80, 100, false, 185],
  ] as const)('base %i nivel %i PS=%s: IV 20, EV 0, naturaleza neutra → %i', (base, level, hp, expected) => {
    expect(statAt(base, level, hp)).toBe(expected)
  })

  it('los PS de Shedinja son siempre 1', () => {
    expect(candidateOf('shedinja', 50, campaignDefinition, data).stats[0]).toBe(1)
  })

  it('construye nombre, número, tipos traducidos, suma base, stats, habilidad y evolución por nivel', () => {
    expect(candidateOf('bulbasaur', 15, campaignDefinition, data)).toEqual({
      id: 'bulbasaur', name: 'BULBASAUR', dex: 1, types: ['grass', 'poison'], typeNames: ['Planta', 'Veneno'],
      total: 318, stats: [41, 22, 22, 27, 27, 21], ability: 'ESPESURA', evolution: { target: 'IVYSAUR', level: 16 },
    })
    expect(candidateOf('pikachu', 15, campaignDefinition, data).evolution).toBeNull()
    expect(candidateOf('venusaur', 50, campaignDefinition, data).evolution).toBeNull()
  })

  it('conserva identificadores desconocidos sin inventar datos', () => {
    expect(candidateOf('desconocido', 15, campaignDefinition, data)).toMatchObject({
      name: 'DESCONOCIDO', dex: 0, types: [], typeNames: [], stats: [0, 0, 0, 0, 0, 0], total: 0, ability: '', evolution: null,
    })
  })

  it('wrapText respeta el ancho, el límite exacto y el orden de las palabras', () => {
    const measure = (line: string) => line.length * 2
    expect(wrapText('UNO DOS TRES', 14, measure)).toEqual(['UNO DOS', 'TRES'])
    expect(wrapText('UNO', 6, measure)).toEqual(['UNO'])
    expect(wrapText('', 14, measure)).toEqual([''])
  })

  it('las notas explican la evolución o su ausencia y caben en la fuente del juego', () => {
    for (const id of ['bulbasaur', 'venusaur']) {
      const notes = candidateNotes(candidateOf(id, 15, campaignDefinition, data))
      expect(notes.join(' ')).toBe(id === 'bulbasaur' ? 'Evoluciona a IVYSAUR en el Nv16.' : 'No evoluciona por nivel.')
      expect(notes.every(line => textWidth(emeraldTheme.font as BitmapFont, line) <= 144)).toBe(true)
    }
  })
})
