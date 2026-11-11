import { describe, expect, it } from 'vitest'
import calendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import descriptions from '../../../data/nuzlocke/emerald-item-descriptions-es.json'
import names from '../../../data/nuzlocke/emerald-item-names-es.json'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'

// UT-185 · Objetos de la campaña (Mochila y canje): nombre de la época y descripción para cada equipable y cada objeto del canje.
const font = emeraldTheme.font as BitmapFont
const wanted = [...new Set([...Object.keys(calendar.held), ...calendar.exchange.map((entry) => entry.item)])].sort()

describe('nombres y descripciones de los objetos', () => {
  it('hay uno de cada para todos los objetos de la campaña, y ninguno de más', () => {
    expect(Object.keys(names.items).sort()).toEqual(wanted)
    expect(Object.keys(descriptions.items).sort()).toEqual(wanted)
  })

  it.each(Object.entries(names.items))('%s: nombre en mayúsculas de 12 letras como mucho (Gen 3)', (_, name) => {
    expect(name).toBe(name.toUpperCase())
    expect([...name].length).toBeLessThanOrEqual(12)
  })

  it.each(Object.entries(descriptions.items))('%s: tres líneas como mucho, que caben en la ventana de la Mochila (100 px)', (_, text) => {
    const lines = text.split('\n')
    expect(lines.length).toBeLessThanOrEqual(3)
    for (const line of lines) expect(textWidth(font, line), line).toBeLessThanOrEqual(100)
  })
})
