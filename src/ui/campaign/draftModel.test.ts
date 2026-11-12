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
      // Cambio de requisito (Jose, 12/11/2026): descripción de la habilidad y cómo evoluciona por cualquier método.
      abilityText: 'Potencia PLANTA en apuros.', evolutionText: 'Evoluciona a IVYSAUR en el Nv16.',
      moves: expect.any(Array),
    })
    // Los cuatro con que llegaría: los últimos aprendidos por nivel (Jose, 12/11/2026).
    expect(candidateOf('bulbasaur', 15, campaignDefinition, data).moves.map((move) => move.id)).toEqual(['leechseed', 'vinewhip', 'poisonpowder', 'sleeppowder'])
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
      // Cambio de requisito (Jose, 12/11/2026): «No evoluciona.» (las notas cuentan también otros métodos).
      expect(notes.join(' ')).toBe(id === 'bulbasaur' ? 'Evoluciona a IVYSAUR en el Nv16.' : 'No evoluciona.')
      expect(notes.every(line => textWidth(emeraldTheme.font as BitmapFont, line) <= 144)).toBe(true)
    }
  })
})

// Jose, 12/11/2026: también cómo evolucionan los que no lo hacen por nivel; la ventana NOTAS tiene dos líneas.
describe('cómo evoluciona cada candidato', () => {
  const text = (id: string) => candidateOf(id, 15, campaignDefinition, data).evolutionText
  // Cambio de requisito (Jose, 12/11/2026): cada forma con su condición en la campaña (objeto sin intercambio, amistad por victorias).
  it('por nivel, objeto, intercambio, amistad, belleza y varias formas, con las condiciones de la campaña', () => {
    expect(text('bulbasaur')).toBe('Evoluciona a IVYSAUR en el Nv16.')
    expect(text('shellder')).toBe('Evoluciona a CLOYSTER con PIEDRA AGUA.')
    expect(text('kadabra')).toBe('Evoluciona a ALAKAZAM cuando quieras.')
    expect(text('onix')).toBe('Evoluciona a STEELIX con REVEST. METÁLICO.')
    expect(text('golbat')).toBe('Evoluciona a CROBAT tras 3 victorias.')
    expect(text('feebas')).toBe('Evoluciona a MILOTIC tras vencer a NORMAN.')
    expect(text('slowpoke')).toBe('Evoluciona a SLOWBRO (Nv37) o SLOWKING (ROCA DEL REY).')
    expect(text('gloom')).toBe('Evoluciona a VILEPLUME (PIEDRA HOJA) o BELLOSSOM (PIEDRA SOLAR).')
    expect(text('tyrogue')).toBe('Evoluciona a HITMONCHAN, HITMONLEE o HITMONTOP (Nv20).')
    expect(text('nincada')).toBe('Evoluciona a NINJASK en el Nv20.')
    expect(text('aggron')).toBe('No evoluciona.')
    expect(text('eevee')).toMatch(/^Evoluciona (a .*\(con piedras\)|de 5 formas)/)
    expect(text('clamperl')).toBe('Evoluciona a HUNTAIL (DIENTE MARINO) o GOREBYSS (ESCAMA MARINA).')
  })

  it('cabe en las tres líneas de NOTAS para todas las especies de la campaña', () => {
    for (const id of Object.keys(campaignDefinition.species)) {
      expect(candidateNotes(candidateOf(id, 15, campaignDefinition, data)).length, id).toBeLessThanOrEqual(3)
    }
  })
})
