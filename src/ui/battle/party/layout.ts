/**
 * Medidas (píxeles lógicos de la DS, lienzo de 256x384) de la pantalla de equipo, tomadas de capturas de Negro/Blanco
 * (shots/BW_Party.png): las placas de 126x46 van en dos columnas escalonadas 8 px y la barra de PS es la pieza ripeada (64x6).
 */
export const PANEL_WIDTH = 126
export const PANEL_HEIGHT = 46

const COLUMN_X = [1, 130] as const
const FIRST_ROW_Y = [201, 209] as const
const ROW_PITCH = 48

/** Posición de la placa de la fila `index` (0 a 5): izquierda y derecha se alternan. */
export function panelPosition(index: number): { x: number; y: number; side: 'left' | 'right' } {
  const column = index % 2
  return { x: COLUMN_X[column], y: FIRST_ROW_Y[column] + Math.floor(index / 2) * ROW_PITCH, side: column === 0 ? 'left' : 'right' }
}

/** Dentro de una placa: el icono (40x30), el texto y la barra de PS (pieza ripeada de 64x6, con la pista a partir de x=13 y 48 px de relleno). */
export const PANEL = {
  icon: { x: 5, y: 6 },
  name: { x: 40, y: 8 },
  gender: { x: 104, y: 11 },
  bar: { x: 45, y: 24 },
  barFill: { x: 59, y: 26, width: 48 },
  level: { x: 8, y: 28 },
  /** Estado (PAR, FNT…): siempre en la misma x, centrado en vertical con los PS (decisión de Jose). */
  status: { x: 40, y: 33 },
  hp: { right: 20, y: 28 },
} as const

export const MESSAGE_BOX = { x: 3, y: 356, width: 178, height: 22 }
export const BAR_TOP = 360

/** Franjas de la placa (y superior e inferior dentro de ella) donde quedan centradas las mayúsculas del nombre y de la fila inferior (nivel y PS). */
export const PANEL_BANDS = { name: [8, 24], bottomRow: [31, 43] } as const
