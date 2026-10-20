const pad = (value: number): string => String(value).padStart(2, '0')

/** Fecha local del dispositivo como YYYY-MM-DD (getters locales, nunca UTC). */
export function localDate(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
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

/** Milisegundos hasta la próxima medianoche local real (días de 23/25 h incluidos). */
export function msUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return nextMidnight.getTime() - now.getTime()
}
