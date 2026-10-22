import { LAUNCH_DATE } from '../core/launch'

/** Suma días a 'YYYY-MM-DD' con Date.UTC (sin depender de la zona ni del horario de verano). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

/** Día #1 del reto; los tests que cuentan días desde el lanzamiento lo siguen sin fijar su valor. */
export const LAUNCH = LAUNCH_DATE
export const dates = (n: number, from = LAUNCH): string[] => range(n).map((i) => addDays(from, i))

/**
 * Fechas de referencia del plan de pruebas (§0). Literales a propósito: solo las usa el snapshot del generador,
 * que es el único test ligado a fechas reales y a LAUNCH_DATE.
 */
export const REFERENCE_DATES = [
  '2026-10-18', // D-1
  '2026-10-19', // D0
  '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', // D+1..D+4
  '2026-10-24', // D+5 (último día del ciclo 1; con 6 entrenadores el ciclo 2 empieza en D+6)
  '2027-10-19', // D+365
  '2027-03-27', '2027-03-28', '2027-03-29', // cambio de hora de primavera 2027 (Madrid)
  '2027-10-30', '2027-10-31', '2027-11-01', // cambio de hora de otoño 2027
]

/** Ejecuta fn con TZ temporal y la restaura. */
export function withTZ<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}
