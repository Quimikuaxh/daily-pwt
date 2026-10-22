import { addDays } from '../core/date'
import type { DayRecord } from './gameStore'

export type PlayerStats = {
  /** Oficiales terminados: victorias, derrotas y anulados (`void`). */
  played: number
  wins: number
  /** Porcentaje entero de victorias sobre los jugados (0 si no hay ninguno). */
  winPercent: number
  winStreak: number
  maxWinStreak: number
  dayStreak: number
  maxDayStreak: number
}

const isFinished = (record: DayRecord): boolean => record.status !== 'inProgress'

/** Rachas de días naturales seguidos que cumplen `counts`: la máxima y la actual (viva hasta hoy o, si hoy no está terminado, hasta ayer). */
function streaks(finished: readonly DayRecord[], today: string, counts: (record: DayRecord) => boolean): { current: number; max: number } {
  let max = 0
  let run = 0
  let previous: string | null = null
  for (const record of finished) {
    run = counts(record) ? (previous !== null && addDays(previous, 1) === record.date ? run + 1 : 1) : 0
    previous = counts(record) ? record.date : null
    max = Math.max(max, run)
  }
  const dates = new Set(finished.filter(counts).map((record) => record.date))
  const playedToday = finished.some((record) => record.date === today)
  let cursor = playedToday ? today : addDays(today, -1)
  let current = 0
  while (dates.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }
  return { current, max }
}

/**
 * Estadísticas del historial de oficiales (PRD §10.4, §11; decisiones de Jose del 22/10/2026):
 * - Racha de victorias: días seguidos con el oficial ganado. Una derrota, un anulado o un día sin jugar la ponen a 0.
 * - Racha de días: días naturales seguidos con el oficial terminado (también el anulado).
 * En las dos, si hoy aún no está terminado, sigue viva la de ayer.
 * Un oficial en curso no cuenta para nada todavía.
 */
export function computeStats(days: readonly DayRecord[], today: string): PlayerStats {
  const finished = days.filter(isFinished).sort((first, second) => first.date.localeCompare(second.date))
  const wins = finished.filter((record) => record.status === 'won').length

  const { current: winStreak, max: maxWinStreak } = streaks(finished, today, (record) => record.status === 'won')
  const { current: dayStreak, max: maxDayStreak } = streaks(finished, today, () => true)

  return {
    played: finished.length,
    wins,
    winPercent: finished.length > 0 ? Math.round((100 * wins) / finished.length) : 0,
    winStreak,
    maxWinStreak,
    dayStreak,
    maxDayStreak,
  }
}
