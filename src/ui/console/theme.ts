/**
 * Temas de consola por juego (DEC-95): lo que una pantalla «dentro del juego» necesita saber de él. Cada juego es una configuración
 * (themes/<juego>.ts) y sus recursos los saca su receta de scripts/decomp/. Los componentes (ConsoleStage, GameText, GameWindow) no saben
 * nada de un juego concreto.
 */

/** Tinta y sombra de un color de texto con nombre; `null` es sin sombra. */
export type TextColor = readonly [ink: string, shadow: string | null]

/**
 * Fuente de mapa de bits del juego: máscaras de tinta y sombra (una por fuente, rejilla de `glyph.columns` glifos de `glyph.w` x
 * `glyph.h`), tabla de caracteres (texto → código de glifo; las secuencias `{LV}`, `{PP}`… son símbolos especiales) y anchos por glifo.
 */
export type BitmapFont = {
  kind: 'bitmap'
  charmap: Readonly<Record<string, number>>
  widths: Readonly<Record<string, readonly number[]>>
  glyph: { w: number; h: number; columns: number }
  /** URL de la máscara de `font` y capa (`ink` o `shadow`). */
  mask: (font: string, layer: 'ink' | 'shadow') => string
  /** Relleno de los números alineados a la derecha (`STR_CONV_MODE_RIGHT_ALIGN`): en Esmeralda, `{SPACER}`. */
  numberPad: string
}

/** Fuente TTF (el reto diario de N2/B2 pinta su texto con pokemon-dp.ttf y CSS). */
export type TtfFont = { kind: 'ttf'; family: string }

export type ConsoleTheme = {
  id: string
  name: string
  /** Pantalla lógica en píxeles del juego y cuántas van apiladas. */
  screen: { w: number; h: number }
  screens: number
  font: BitmapFont | TtfFont
  /** Marco de ventana a 9 cortes (imagen, tesela y corte), como las plantillas de ventana del juego; null si no lo usa. */
  frame: { image: string; tile: number; slice: number } | null
  colors: Readonly<Record<string, TextColor>>
  /** URL de un recurso de la interfaz del juego por nombre (sin extensión). */
  asset: (name: string) => string
}

export const rgbHex = (rgb: readonly number[]): string => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
