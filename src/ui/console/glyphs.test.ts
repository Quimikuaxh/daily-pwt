import { describe, it, expect, vi } from 'vitest'
import font from '../../generated/emerald/font.json'
import sprites from '../../generated/emerald/sprites.json'
import { accessibleText, glyphCodes, padNumber, textWidth } from './glyphs'
import type { BitmapFont } from './theme'
import { consoleScale } from '../battle/useStageScale'

// DEC-95: temas de consola por juego. Fuente de Esmeralda (src/fonts.c y charmap.txt de pret/pokeemerald 731ad5b, `gen:emerald-ui`).
const emerald: BitmapFont = {
  kind: 'bitmap',
  charmap: font.charmap,
  widths: font.fonts,
  glyph: { w: 16, h: 16, columns: 16 },
  mask: () => '',
  numberPad: font.rellenoNumerico,
}

describe('glifos de la fuente del juego', () => {
  it('traduce letras, acentos y símbolos del juego a sus códigos', () => {
    expect(glyphCodes(emerald, 'A')).toEqual([font.charmap.A])
    expect(glyphCodes(emerald, '{LV}5')).toEqual([font.charmap['{LV}'], font.charmap['5']])
    expect(font.charmap['é']).toBeDefined()
    expect(font.charmap['Ñ']).toBeDefined()
  })

  it('un carácter que no está se pinta como «?» y avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(glyphCodes(emerald, '☃')).toEqual([font.charmap['?']])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('UT-167: los símbolos sin etiqueta accesible desaparecen sin alterar el texto restante', () => {
    expect(accessibleText('  A {SIN_ETIQUETA}   B {LV_2}20 {NO}7  ')).toBe('A B Nv20 Nº7')
    expect(accessibleText('{SIN_ETIQUETA}{SPACER}')).toBe('')
    expect(accessibleText('')).toBe('')
  })

  it('UT-167: trata un símbolo desconocido como un único glifo y admite texto vacío', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(glyphCodes(emerald, '{DESCONOCIDO}')).toEqual([font.charmap['?']])
      expect(warn).toHaveBeenCalledOnce()
      expect(glyphCodes(emerald, '')).toEqual([])
      expect(textWidth(emerald, '', 'normal', 3)).toBe(0)
    } finally {
      warn.mockRestore()
    }
  })

  it('el ancho suma los glifos y el espaciado entre ellos, no tras el último (GetStringWidth)', () => {
    const a = font.fonts.normal[font.charmap.A]
    const b = font.fonts.normal[font.charmap.B]
    expect(textWidth(emerald, 'AB')).toBe(a + b)
    expect(textWidth(emerald, 'AB', 'normal', 1)).toBe(a + b + 1)
    expect(textWidth(emerald, 'AB', 'narrow')).toBeLessThanOrEqual(a + b)
  })

  it('los números se alinean a la derecha con el relleno del juego y el texto accesible quita los símbolos', () => {
    expect(padNumber(emerald, 7, 3)).toBe('{SPACER}{SPACER}7')
    expect(padNumber(emerald, 120, 3)).toBe('120')
    expect(accessibleText('{LV}19')).toBe('Nv19')
    expect(accessibleText('{SPACER}{SPACER}7/{SPACER}51')).toBe('7/51')
    expect(accessibleText('{PP}20/20')).toBe('PP20/20')
  })
})

describe('recursos de Esmeralda', () => {
  it('trae las 386 especies con su número, posición y animación del frente', () => {
    expect(Object.keys(sprites)).toHaveLength(386)
    expect(sprites.torchic.dex).toBe(255)
    expect(sprites.deoxys.dex).toBe(386)
    expect(sprites.torchic.anim.length).toBeGreaterThan(0)
  })
})

describe('escala de un lienzo de consola (regla del reto diario)', () => {
  it('entera desde x2 y hasta x4; por debajo, la fraccionaria que quepa', () => {
    expect(consoleScale(1280, 800, 240, 320)).toBe(2)
    expect(consoleScale(1920, 1400, 240, 320)).toBe(4)
    expect(consoleScale(360, 740, 240, 320)).toBe(1.5)
    expect(consoleScale(200, 200, 240, 320)).toBe(1)
  })
})
