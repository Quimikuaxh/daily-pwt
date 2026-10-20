/**
 * Franjas (y superior e inferior, en píxeles nativos de la DS) de cada texto de la pantalla de datos, medidas sobre el fondo limpiado
 * (`public/ui/battle/summary/*`): entre las líneas de la rejilla, dentro de la franja de la cabecera, de la placa del nombre, etc.
 * El texto se coloca para que sus mayúsculas queden centradas en la franja (`topInBand`); el test e2e comprueba el resultado con la
 * métrica real de la fuente cargada. Cambiar de fuente solo obliga a revisar `FONT_CAP`.
 */
export type Band = readonly [top: number, bottom: number]
export type TextSize = 'normal' | 'small' | 'tiny' | 'head'

/**
 * Fuente del juego (DP): alto de las mayúsculas y distancia de su borde superior al `top` del elemento (con `margin-top: -2px` y
 * `line-height: 13px` en los textos normales, 0 y 13 px en cabecera). Medido con `measureText('H')` y la sonda de línea base.
 */
export const FONT_CAP: Record<TextSize, { capHeight: number; capTopOffset: number }> = {
  normal: { capHeight: 9, capTopOffset: 2 },
  small: { capHeight: 8, capTopOffset: 2 },
  tiny: { capHeight: 8, capTopOffset: 1 },
  head: { capHeight: 9, capTopOffset: 3 },
}

/** `top` del elemento para que las mayúsculas queden centradas verticalmente en la franja. */
export function topInBand([top, bottom]: Band, size: TextSize = 'normal'): number {
  const { capHeight, capTopOffset } = FONT_CAP[size]
  return Math.round((top + bottom) / 2 - capHeight / 2 - capTopOffset)
}

/** Línea de texto `index` de la página Información (panel claro de arriba, filas de 16 px). */
export const infoLine = (index: number): Band => [40 + 16 * index, 56 + 16 * index]
/** Fila `index` (0 a 4) de la tabla de la pantalla de abajo en Información. */
export const infoRow = (index: number): Band => [199 + 16 * index, 215 + 16 * index]
/** Fila `index` (0 a 4) de estadísticas de Habilidades: franjas de la tabla entre sus líneas de rejilla. */
export const statRow = (index: number): Band => [57 + 16 * index, 73 + 16 * index]
/** Fila `index` (0 a 2) de Movimientos: categoría, potencia, precisión. */
export const moveDetailRow = (index: number): Band => [48 + 16 * index, 64 + 16 * index]

export const BANDS = {
  header: [11, 22],
  natureLabel: [281, 296],
  natureValue: [297, 312],
  hpLabel: [313, 328],
  hpValue: [329, 344],
  monName: [193, 209],
  monLevel: [209, 223],
  itemLabel: [329, 344],
  itemValue: [345, 359],
  hpRow: [33, 48],
  abilityBar: [144, 159],
} as const satisfies Record<string, Band>
