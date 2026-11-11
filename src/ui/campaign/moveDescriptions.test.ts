import { describe, expect, it } from 'vitest'
import descriptions from '../../../data/nuzlocke/emerald-move-descriptions-es.json'
import moves from '../../generated/emerald/moves.json'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'

// UT-174 · Descripciones de movimientos de la campaña (D7): una por movimiento, en dos líneas que caben en los dos huecos del juego.
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
