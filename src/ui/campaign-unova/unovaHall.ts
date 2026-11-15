/**
 * Composición del Salón de la Fama de Teselia, tal cual las maquetas aprobadas (PRD §0, «Locke de N2/B2: Salón de la Fama» y «… compartir»,
 * 14/11/2026; `compartir-gana.png`): fondo oscuro con una Poké Ball gris grande a la izquierda, la banda blanca de arriba, la barra oscura
 * de abajo y los seis en dos filas que se solapan (atrás dos a los lados y uno en el centro, detrás del protagonista; delante dos a los
 * lados y uno a sus pies). La usan la pantalla del Salón y la imagen para compartir.
 */

/** Hueco de un Pokémon: esquina de arriba a la izquierda, lado de la caja en que cabe el sprite (sin agrandarlo) y si va delante del protagonista. */
export type HallSpot = { x: number; y: number; size: number; front: boolean }

/** En el orden del equipo: atrás a la izquierda, atrás a la derecha, atrás en el centro, delante a la izquierda, delante a la derecha y a los pies. */
const SPOTS: readonly HallSpot[] = [
  { x: 4, y: 26, size: 80, front: false },
  { x: 172, y: 26, size: 80, front: false },
  { x: 88, y: 20, size: 76, front: false },
  { x: -6, y: 82, size: 92, front: true },
  { x: 176, y: 82, size: 92, front: true },
  { x: 92, y: 96, size: 80, front: true },
]

/** Protagonista (80 x 80 reducido a 64 x 64), entre las dos filas. */
export const HALL_PROTAGONIST = { left: 64, top: 70, size: 64 } as const

export const unovaHallSpots = (count: number): HallSpot[] => SPOTS.slice(0, Math.max(0, Math.min(6, count)))

/** Índices en orden de pintado: el del centro de atrás primero, luego los lados de atrás y después los de delante (que tapan a los de atrás). */
export const unovaHallOrder = (count: number): number[] =>
  unovaHallSpots(count).map((spot, i) => ({ spot, i }))
    .sort((a, b) => Number(a.spot.front) - Number(b.spot.front) || Number(b.i === 2) - Number(a.i === 2) || a.i - b.i)
    .map(({ i }) => i)

/** Colores del fondo: fondo, Poké Ball (borde claro, interior, banda y botón), banda de arriba y su texto, barra de abajo y su raya. */
export const HALL_COLORS = { bg: '#1c1c20', rim: '#96969c', inner: '#6e6e74', band: '#f0f0f0', bandText: '#282830', bar: '#101014', barLine: '#dcdcdc' }
/** Formas de la Poké Ball en orden de pintado (elipses por su caja, como las dibuja la maqueta; la raya, un rectángulo). */
const BALL: readonly ({ kind: 'ellipse' | 'rect'; box: readonly [number, number, number, number]; color: string })[] = [
  { kind: 'ellipse', box: [-70, -10, 170, 230], color: HALL_COLORS.rim },
  { kind: 'ellipse', box: [-58, 2, 158, 218], color: HALL_COLORS.inner },
  { kind: 'rect', box: [-70, 104, 170, 124], color: HALL_COLORS.bg },
  { kind: 'ellipse', box: [14, 78, 86, 150], color: HALL_COLORS.bg },
  { kind: 'ellipse', box: [26, 90, 74, 138], color: HALL_COLORS.rim },
]
/** Banda de arriba (y de inicio y fin) y barra de abajo (su raya va en `bar.top`). */
export const HALL_BAND = { top: 8, bottom: 26 } as const
export const HALL_BAR = { top: 166 } as const
/** Destellos (centro de cada cruz de 7 px). */
export const HALL_SPARKLES: readonly [number, number][] = [[40, 50], [200, 44], [222, 124], [118, 40], [30, 140], [236, 70]]

const inside = (kind: 'ellipse' | 'rect', [x0, y0, x1, y1]: readonly [number, number, number, number], x: number, y: number) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  if (kind === 'rect') return true
  const rx = (x1 - x0 + 1) / 2
  const ry = (y1 - y0 + 1) / 2
  const dx = (x + 0.5 - (x0 + rx)) / rx
  const dy = (y + 0.5 - (y0 + ry)) / ry
  return dx * dx + dy * dy <= 1
}

/** Color del fondo del Salón en (x, y). Píxel a píxel: una elipse del canvas saldría suavizada. */
export function hallColor(x: number, y: number): string {
  if (y >= HALL_BAND.top && y <= HALL_BAND.bottom) return HALL_COLORS.band
  if (y === HALL_BAR.top) return HALL_COLORS.barLine
  if (y > HALL_BAR.top) return HALL_COLORS.bar
  let color = HALL_COLORS.bg
  for (const shape of BALL) if (inside(shape.kind, shape.box, x, y)) color = shape.color
  return color
}
