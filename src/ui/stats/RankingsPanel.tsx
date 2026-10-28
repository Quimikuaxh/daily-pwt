import { useEffect, useState } from 'react'
import type { CloudApi, PointsRow, RankingScope, StreakRow } from '../../cloud/api'
import { es } from '../../i18n/es'
import { esCloud } from '../../i18n/esCloud'
import './cloud.css'

const text = esCloud.ranking

type Kind = 'points' | 'streak'
type Rows = { kind: 'points'; rows: PointsRow[] } | { kind: 'streak'; rows: StreakRow[] }

/** Primer día del mes de `date` (YYYY-MM-DD) desplazado `offset` meses. */
export function monthStart(date: string, offset = 0): string {
  const [year, month] = date.split('-').map(Number)
  const index = year * 12 + (month - 1) + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
}

/**
 * Rankings (RF-106 a RF-109, RF-112): puntos del mes o racha actual, global o entre amigos. Empates con la misma posición. El jugador sale
 * marcado y, si no está entre los primeros, al final. Los jugadores con cuenta llevan el tick de verificado; sin cuenta (`member`
 * falso) se aparece en el global, pero no hay vista de amigos.
 */
export function RankingsPanel({ api, today, member }: { api: CloudApi | null; today: string; member: boolean }) {
  const [kind, setKind] = useState('points' as Kind)
  const [scope, setScope] = useState('global' as RankingScope)
  const [monthOffset, setMonthOffset] = useState(0)
  const [result, setResult] = useState({ key: '', rows: null } as { key: string; rows: Rows | null })
  const month = monthStart(today, monthOffset)
  const key = `${kind}|${scope}|${month}`

  useEffect(() => {
    if (!api) return
    let cancelled = false
    const load = kind === 'points' ? api.pointsRanking(month, scope).then((rows): Rows => ({ kind, rows })) : api.streakRanking(scope).then((rows): Rows => ({ kind, rows }))
    load.then(
      (rows) => !cancelled && setResult({ key, rows }),
      () => !cancelled && setResult({ key, rows: null }),
    )
    return () => {
      cancelled = true
    }
  }, [api, kind, scope, month, key])

  const loading = result.key !== key
  const rows = loading ? null : result.rows
  const [year, monthNumber] = month.split('-').map(Number)

  return (
    <div className="rankings-panel">
      <div className="settings-options" role="group" aria-label={text.kindLabel}>
        {(['points', 'streak'] as const).map((option) => (
          <button key={option} type="button" className="btn btn-small settings-option" aria-pressed={kind === option} onClick={() => setKind(option)}>
            {option === 'points' ? text.points : text.streak}
          </button>
        ))}
      </div>
      <div className="settings-options" role="group" aria-label={text.scopeLabel}>
        {(['global', 'friends'] as const).map((option) => (
          <button key={option} type="button" className="btn btn-small settings-option" aria-pressed={scope === option} disabled={option === 'friends' && !member} onClick={() => setScope(option)}>
            {option === 'global' ? text.global : text.friends}
          </button>
        ))}
      </div>
      {kind === 'points' && (
        <div className="ranking-month">
          <button type="button" className="btn btn-small" aria-label={text.previousMonth} onClick={() => setMonthOffset(monthOffset - 1)}>‹</button>
          <span aria-live="polite">{text.month(year, monthNumber)}</span>
          <button type="button" className="btn btn-small" aria-label={text.nextMonth} disabled={monthOffset >= 0} onClick={() => setMonthOffset(monthOffset + 1)}>›</button>
        </div>
      )}
      {!member && <p className="settings-hint">{text.signInToAppear}</p>}
      <RankingBody available={api !== null} loading={loading} rows={rows} />
    </div>
  )
}

function RankingBody({ available, loading, rows }: { available: boolean; loading: boolean; rows: Rows | null }) {
  if (!available) {
    return <p className="settings-hint">{esCloud.account.offline}</p>
  }
  if (loading) {
    return <p className="settings-hint" role="status">{es.ranking.loading}</p>
  }
  if (rows === null) {
    return <p className="settings-hint" role="alert">{text.failed}</p>
  }
  if (rows.rows.length === 0) {
    return <p className="settings-hint">{text.empty}</p>
  }
  return <RankingTable rows={rows} />
}

const isProvisional = (row: PointsRow) => row.provisional

/** Tick de verificado (RF-112): jugador con cuenta. En píxel, como los iconos de la cabecera. */
function VerifiedIcon() {
  return (
    <svg className="ranking-verified" viewBox="0 0 8 8" width="16" height="16" role="img" aria-label={text.verified} shapeRendering="crispEdges">
      <title>{text.verified}</title>
      <path d="M2 0h4v1H2zM1 1h6v1H1zM0 2h8v4H0zM1 6h6v1H1zM2 7h4v1H2z" fill="#3888f8" />
      <path d="M5 2h1v1H5zM4 3h1v1H4zM1 3h1v1H1zM2 4h1v1H2zM3 4h1v1H3z" fill="#f8f8f8" />
    </svg>
  )
}

function RankingTable({ rows }: { rows: Rows }) {
  const provisional = rows.kind === 'points' && rows.rows.some(isProvisional)
  return (
    <>
      <table className="ranking-table">
        <thead>
          <tr>
            <th scope="col">{text.position}</th>
            <th scope="col">{text.player}</th>
            <th scope="col">{rows.kind === 'points' ? text.pointsColumn : text.streakColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.rows.map((row, index) => (
            <tr key={`${row.rank}-${row.nickname ?? index}`} className={row.me ? 'ranking-me' : undefined} aria-current={row.me ? 'true' : undefined}>
              <td>{row.rank}</td>
              <td>
                {row.nickname ?? text.noName}
                {row.verified && <VerifiedIcon />} {row.me && <span className="ranking-you">{text.you}</span>}
              </td>
              <td>{'points' in row ? es.ranking.formatPoints(row.points) : row.streak}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {provisional && <p className="stats-note">{text.provisional}</p>}
    </>
  )
}
