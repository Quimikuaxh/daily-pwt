/**
 * Composición del Salón de la Fama de Teselia (PRD §0, «Locke de N2/B2: compartir», 14/11/2026): el protagonista en medio y los seis en dos
 * filas que se solapan, atrás dos a los lados y uno en el centro, delante dos a los lados y uno a sus pies. La usan la pantalla del Salón
 * y la imagen para compartir.
 */

/** Centro de cada hueco (x, y) en la pantalla de 256 x 192 y si va en la fila de delante (por encima del protagonista). */
export type HallSpot = { x: number; y: number; front: boolean }

/** Orden de llenado: el primero a los pies del protagonista; luego los lados de atrás, los de delante y el centro de atrás. */
const SPOTS: readonly HallSpot[] = [
  { x: 128, y: 132, front: true },
  { x: 52, y: 84, front: false },
  { x: 204, y: 84, front: false },
  { x: 72, y: 124, front: true },
  { x: 184, y: 124, front: true },
  { x: 128, y: 70, front: false },
]

/** Protagonista (80 x 80): centrado, con los pies en y 150. */
export const HALL_PROTAGONIST = { left: 88, top: 70 } as const

export const unovaHallSpots = (count: number): HallSpot[] => SPOTS.slice(0, Math.max(0, Math.min(6, count)))

/** Índices en orden de pintado: los de atrás antes (de arriba abajo), luego los de delante; así la fila de delante tapa a la de atrás. */
export const unovaHallOrder = (count: number): number[] =>
  unovaHallSpots(count).map((spot, i) => ({ spot, i })).sort((a, b) => Number(a.spot.front) - Number(b.spot.front) || a.spot.y - b.spot.y || a.i - b.i)
    .map(({ i }) => i)

/** Colores del fondo (fondo, Poké Ball: mitad de arriba, de abajo, banda y botón; banda y barra). */
export const HALL_COLORS = { bg: '#101018', top: '#2c2c34', bottom: '#24242a', line: '#18181e', button: '#585860', buttonIn: '#303038',
  band: '#283c98', bandEdge: '#f8d838', bar: '#1c1c26', barEdge: '#585860' }
export const HALL_BALL = { cx: 128, cy: 110, r: 80, line: 6, button: 22, buttonIn: 15 }
export const HALL_BAND_TOP = 6
export const HALL_BAR_TOP = 172

/** Color de la Poké Ball en (x, y), o `null` fuera de ella. Píxel a píxel: un círculo del canvas saldría suavizado. */
export function ballColor(x: number, y: number): string | null {
  const dx = x + 0.5 - HALL_BALL.cx
  const dy = y + 0.5 - HALL_BALL.cy
  const d = Math.hypot(dx, dy)
  if (d > HALL_BALL.r) return null
  if (d > HALL_BALL.r - 4) return HALL_COLORS.line
  if (d <= HALL_BALL.buttonIn) return HALL_COLORS.buttonIn
  if (d <= HALL_BALL.button) return HALL_COLORS.button
  if (Math.abs(dy) <= HALL_BALL.line / 2) return HALL_COLORS.line
  return dy < 0 ? HALL_COLORS.top : HALL_COLORS.bottom
}
