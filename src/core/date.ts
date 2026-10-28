/**
 * El reto cambia para todos a la medianoche de Madrid (hora peninsular española, con su horario de verano): decisión de Jose del
 * 28/10/2026, para que el día sea el mismo en todo el mundo y cuadre con el cierre del día del servidor (F4). *Descartado:* la medianoche
 * de cada dispositivo (el día no coincidía entre husos y el servidor no podía validar ni cerrar el día).
 */
export const CHALLENGE_TIME_ZONE = 'Europe/Madrid'

const madridClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHALLENGE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Hora de pared de Madrid en `now`, como milisegundos «UTC» (sirve para restar y sacar el desfase). */
function madridWallClock(now: Date): number {
  const parts = Object.fromEntries(madridClock.formatToParts(now).map((part) => [part.type, part.value]))
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second), now.getUTCMilliseconds())
}

/** Fecha del reto en `now` (YYYY-MM-DD): la fecha de Madrid, sea cual sea la zona del dispositivo (RF-01). */
export function challengeDate(now: Date): string {
  return new Date(madridWallClock(now)).toISOString().slice(0, 10)
}

/** Instante en que en Madrid son las `h:mi:s` de `date` (días de 23 y 25 h incluidos). */
export function madridInstant(date: string, h = 0, mi = 0, s = 0): Date {
  const wall = utcDay(date) + ((h * 60 + mi) * 60 + s) * 1000
  // El desfase depende del propio instante: dos pasadas bastan también junto a los cambios de hora.
  let instant = wall
  for (let pass = 0; pass < 2; pass++) instant = wall - (madridWallClock(new Date(instant)) - instant)
  return new Date(instant)
}

function utcDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

const MS_PER_DAY = 86_400_000

/** Días enteros desde el lanzamiento (puede ser negativo). Con Date.UTC, sin efecto del horario de verano. */
export function dayIndex(date: string, launchDate: string): number {
  return Math.round((utcDay(date) - utcDay(launchDate)) / MS_PER_DAY)
}

/** #N: días desde el lanzamiento + 1; una fecha anterior cuenta como #1. */
export function challengeNumber(date: string, launchDate: string): number {
  return Math.max(0, dayIndex(date, launchDate)) + 1
}

/** Milisegundos hasta la próxima medianoche de Madrid, es decir, hasta el siguiente reto (RF-30). */
export function msUntilNextChallenge(now: Date): number {
  return madridInstant(addDays(challengeDate(now), 1)).getTime() - now.getTime()
}

/** Suma (o resta) días a 'YYYY-MM-DD' sin depender de la zona horaria. */
export function addDays(date: string, days: number): string {
  return new Date(utcDay(date) + days * MS_PER_DAY).toISOString().slice(0, 10)
}
