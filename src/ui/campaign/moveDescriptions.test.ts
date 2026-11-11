import { describe, expect, it } from 'vitest'
import descriptions from '../../../data/nuzlocke/emerald-move-descriptions-es.json'
import moves from '../../generated/emerald/moves.json'
import names from '../../../data/nuzlocke/emerald-move-names-es.json'
import { emeraldBattleNames, emeraldMoveName } from './emeraldNames'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'

// UT-174 · Descripciones y nombres de la época de los movimientos de la campaña (D7).
const font = emeraldTheme.font as BitmapFont
const texts = descriptions.moves as Record<string, string>

describe('descripciones de movimientos en español', () => {
  it('hay una por cada movimiento de la campaña y ninguna de más', () => {
    expect(Object.keys(texts).sort()).toEqual(Object.keys(moves).sort())
  })

  it.each(Object.entries(texts))('%s: dos líneas como mucho, que caben en el Recordador (128 px, estrecha) y en Datos (148 px, normal)', (_, text) => {
    const lines = text.split('\n')
    expect(lines.length).toBeLessThanOrEqual(2)
    for (const line of lines) {
      expect(textWidth(font, line, 'narrow'), line).toBeLessThanOrEqual(128)
      expect(textWidth(font, line, 'normal'), line).toBeLessThanOrEqual(148)
    }
  })
})

describe('nombres de la época (D6 de la campaña)', () => {
  const eraNames = names.moves as Record<string, string>
  it('hay uno por movimiento de la campaña, en mayúsculas y de 12 letras como mucho, como en Gen 3', () => {
    expect(Object.keys(eraNames).sort()).toEqual(Object.keys(moves).sort())
    for (const [id, name] of Object.entries(eraNames)) {
      expect(name, id).toBe(name.toUpperCase())
      expect([...name].length, id).toBeLessThanOrEqual(12)
    }
  })

  it('usan el nombre de Esmeralda donde cambió', () => {
    expect(eraNames.tailwhip).toBe('LÁTIGO')
    expect(eraNames.quickattack).toBe('AT. RÁPIDO')
    expect(emeraldMoveName('tailwhip', { moves: { tailwhip: 'Agitacola' } } as never)).toBe('LÁTIGO')
    expect(emeraldBattleNames({ moves: { tailwhip: 'Agitacola' }, species: { abra: 'Abra' } } as never)).toMatchObject({ moves: { tailwhip: 'LÁTIGO' }, species: { abra: 'ABRA' } })
  })
})
