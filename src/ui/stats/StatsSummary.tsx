import type { DayPoints } from '../../cloud/api'
import { TEAM_SIZE } from '../../core/constants'
import { es } from '../../i18n/es'
import type { DayRecord } from '../../storage/gameStore'
import { computeStats } from '../../storage/playerStats'
import { ShareButton } from '../share/ShareButton'
import { shareTextFor } from '../share/shareText'
import { StatsPanel } from './StatsPanel'

const pointsOfMonth = (points: DayPoints[], today: string) => points.filter((day) => day.date.startsWith(today.slice(0, 7))).reduce((total, day) => total + day.points, 0)

const finishedOn = (date: string) => (day: DayRecord) => day.date === date && (day.status === 'won' || day.status === 'lost')

type StatsSummaryProps = {
  days: DayRecord[]
  today: string
  /** Puntos por día (con cuenta configurada); `null`, sin la fila de puntos. */
  points: DayPoints[] | null
  /** Los del propio jugador: con los Pokémon en pie de hoy hasta el cierre y el botón de compartir. Los de un amigo, sin ellos. */
  own: boolean
  note?: string
}

/**
 * Estadísticas de «Yo» y, con los mismos datos y la misma forma, las de un amigo (decisión de Jose, 29/10/2026): jugados, victorias,
 * rachas y distribución, y con cuenta los puntos del mes.
 */
export function StatsSummary({ days, today, points, own, note }: StatsSummaryProps) {
  const stats = computeStats(days, today)
  const text = own ? shareTextFor(days, today) : null
  const monthPoints = pointsOfMonth(points ?? [], today)
  // Los puntos de hoy no existen hasta el cierre del día (medianoche de Madrid): se enseña con cuántos Pokémon acabó el oficial.
  const todayRecord = own ? days.find(finishedOn(today)) : undefined

  return (
    <>
      {stats.played === 0 ? <p className="dialog-body">{own ? es.stats.empty : es.stats.friendEmpty}</p> : <StatsPanel stats={stats} />}
      {points && (
        <dl className="stats-totals stats-points">
          <div className="stats-cell">
            <dt>{es.ranking.monthPoints}</dt>
            <dd data-testid="stats-month-points">{es.ranking.formatPoints(monthPoints)}</dd>
          </div>
          {todayRecord && (
            <div className="stats-cell">
              <dt>{es.ranking.todaySurvivors}</dt>
              <dd data-testid="stats-today-survivors">{es.ranking.survivors(todayRecord.status === 'won' ? (todayRecord.survivors ?? 0) : 0, TEAM_SIZE)}</dd>
            </div>
          )}
        </dl>
      )}
      {points && todayRecord && <p className="stats-note">{es.ranking.todayPending}</p>}
      {points && own && <p className="stats-note">{es.ranking.pointsHint}</p>}
      {text && <ShareButton text={text} />}
      {note && <p className="stats-note">{note}</p>}
    </>
  )
}
