import type { BitmapFont } from './theme'

/** Glifo que se pinta cuando un carácter no está en la fuente. */
const FALLBACK = '?'

/**
 * Códigos de glifo de un texto: cada carácter, o cada secuencia `{NOMBRE}` (símbolos del juego como `{LV}` o `{PP}`), por su entrada en
 * la tabla. Lo que no está se pinta como «?» y se avisa en la consola, como en las maquetas.
 */
export function glyphCodes(font: BitmapFont, text: string): number[] {
  return (text.match(/\{[^}]+\}|[\s\S]/gu) ?? []).map((ch) => {
    const code = font.charmap[ch]
    if (code !== undefined) return code
    console.warn(`GameText: «${ch}» no está en la fuente (se pinta «${FALLBACK}»)`)
    return font.charmap[FALLBACK] ?? 0
  })
}

/** Ancho pintado: anchos de los glifos más `spacing` entre ellos, no tras el último (como GetStringWidth del juego). */
export function textWidth(font: BitmapFont, text: string, face = 'normal', spacing = 0): number {
  const codes = glyphCodes(font, text)
  const widths = font.widths[face]
  return codes.reduce((w, code) => w + (widths?.[code] ?? 0), 0) + spacing * Math.max(0, codes.length - 1)
}

/** Número alineado a la derecha en `digits` cifras, con el relleno del juego (ConvertIntToDecimalStringN, modo RIGHT_ALIGN). */
export const padNumber = (font: BitmapFont, value: number, digits: number): string =>
  font.numberPad.repeat(Math.max(0, digits - String(value).length)) + String(value)

/** Texto legible para lectores de pantalla: quita las llaves de los símbolos (`{LV}` → «Nv», `{PP}` → «PP», `{SPACER}` → nada). */
const SYMBOL_LABELS: Readonly<Record<string, string>> = { '{LV}': 'Nv', '{LV_2}': 'Nv', '{PP}': 'PP', '{NO}': 'Nº', '{SPACER}': '' }
export const accessibleText = (text: string): string => text.replace(/\{[^}]+\}/g, (symbol) => SYMBOL_LABELS[symbol] ?? '').replace(/\s+/g, ' ').trim()
