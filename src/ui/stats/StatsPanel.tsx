import { es } from '../../i18n/es'
import type { PlayerStats } from '../../storage/playerStats'

const text = es.stats

/** Cifras de Estadísticas (PRD §10.4): jugados, % de victorias y las dos rachas, actual y máxima. */
export function StatsPanel({ stats }: { stats: PlayerStats }) {
  return (
    <div className="stats-panel">
      <dl className="stats-totals">
        <div className="stats-cell">
          <dt>{text.played}</dt>
          <dd data-testid="stats-played">{stats.played}</dd>
        </div>
        <div className="stats-cell">
          <dt>{text.winPercent}</dt>
          <dd data-testid="stats-win-percent">{stats.winPercent}</dd>
        </div>
      </dl>
      <table className="stats-streaks">
        <thead>
          <tr>
            <td />
            <th scope="col">{text.current}</th>
            <th scope="col">{text.max}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{text.winStreak}</th>
            <td data-testid="stats-win-streak">{stats.winStreak}</td>
            <td data-testid="stats-max-win-streak">{stats.maxWinStreak}</td>
          </tr>
          <tr>
            <th scope="row">{text.dayStreak}</th>
            <td data-testid="stats-day-streak">{stats.dayStreak}</td>
            <td data-testid="stats-max-day-streak">{stats.maxDayStreak}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
