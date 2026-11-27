import { useEffect, useState } from 'react'
import type { CloudApi, PointsRow, RankingPage, RankingScope, StreakRow, SurvivorsRow } from '../../cloud/api'
import { es } from '../../i18n/es'
import { esCloud } from '../../i18n/esCloud'
import { VerifiedIcon } from '../common/VerifiedIcon'
import './cloud.css'
import { Loading } from '../common/Loading'

const text = esCloud.ranking

type Kind = 'points' | 'streak' | 'survivors'
type Rows = ({ kind: 'points' } & RankingPage<PointsRow>) | ({ kind: 'streak' } & RankingPage<StreakRow>) | ({ kind: 'survivors' } & RankingPage<SurvivorsRow>)
const KINDS = ['points', 'streak', 'survivors'] as const satisfies readonly Kind[]
const KIND_LABEL = { points: text.points, streak: text.streak, survivors: text.survivors }
const COLUMN = { points: text.pointsColumn, streak: text.streakColumn, survivors: text.survivorsColumn }

/** Primer día del mes de `date` (YYYY-MM-DD) desplazado `offset` meses. */
export function monthStart(date: string, offset = 0): string {
  const [year, month] = date.split('-').map(Number)
  const index = year * 12 + (month - 1) + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
}

/**
 * Rankings (RF-106 a RF-109, RF-112): puntos del mes o racha actual, global o entre amigos, en páginas de 20 que se abren en la del
 * jugador (decisión de Jose, 28/10/2026). Empates con la misma posición. Los jugadores con cuenta llevan el tick de verificado; sin
 * cuenta (`member` falso) se aparece en el global, pero no hay vista de amigos.
 */
/** `onOpen`: abre las estadísticas e historial de un jugador del ranking (cualquiera, no solo amigos; Jose, 13/11/2026). */
export function RankingsPanel({ api, today, member, onOpen }: { api: CloudApi | null; today: string; member: boolean; onOpen?: (nickname: string) => void }) {
  const [kind, setKind] = useState('points' as Kind)
  const [scope, setScope] = useState('global' as RankingScope)
  const [monthOffset, setMonthOffset] = useState(0)
  // `null`: la página del jugador; cambiar de ranking, de vista o de mes vuelve a ella.
  const [page, setPage] = useState(null as number | null)
  const [result, setResult] = useState({ key: '', rows: null } as { key: string; rows: Rows | null })
  const month = monthStart(today, monthOffset)
  const key = `${kind}|${scope}|${month}|${page}`
  const choose = (change: () => void) => {
    change()
    setPage(null)
  }

  useEffect(() => {
    if (!api) return
    let cancelled = false
    const load: Promise<Rows> =
      kind === 'points'
        ? api.pointsRanking(month, scope, page).then((loaded) => ({ kind, ...loaded }))
        : kind === 'streak'
          ? api.streakRanking(scope, page).then((loaded) => ({ kind, ...loaded }))
          : api.survivorsRanking(scope, page).then((loaded) => ({ kind, ...loaded }))
    load.then(
      (rows) => !cancelled && setResult({ key, rows }),
      () => !cancelled && setResult({ key, rows: null }),
    )
    return () => {
      cancelled = true
    }
  }, [api, kind, scope, month, page, key])

  const loading = result.key !== key
  const rows = loading ? null : result.rows
  const [year, monthNumber] = month.split('-').map(Number)

  return (
    <div className="rankings-panel">
      <div className="ranking-filters">
        <div className="segmented" role="group" aria-label={text.kindLabel}>
          {KINDS.map((option) => (
            <button key={option} type="button" className="segmented-option" aria-pressed={kind === option} onClick={() => choose(() => setKind(option))}>
              {KIND_LABEL[option]}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label={text.scopeLabel}>
          {(['global', 'friends'] as const).map((option) => (
            <button key={option} type="button" className="segmented-option" aria-pressed={scope === option} disabled={option === 'friends' && !member} onClick={() => choose(() => setScope(option))}>
              {option === 'global' ? text.global : text.friends}
            </button>
          ))}
        </div>
      </div>
      {kind === 'points' && (
        <div className="ranking-month">
          <button type="button" className="ranking-arrow" aria-label={text.previousMonth} onClick={() => choose(() => setMonthOffset(monthOffset - 1))}>‹</button>
          <span className="ranking-month-name" aria-live="polite">{text.month(year, monthNumber)}</span>
          <button type="button" className="ranking-arrow" aria-label={text.nextMonth} disabled={monthOffset >= 0} onClick={() => choose(() => setMonthOffset(monthOffset + 1))}>›</button>
        </div>
      )}
      {!member && <p className="settings-hint">{text.signInToAppear}</p>}
      <RankingBody available={api !== null} loading={loading} rows={rows} onOpen={onOpen} />
      {rows && <Pagination rows={rows} onPage={setPage} />}
      {kind === 'points' && monthOffset === 0 && <p className="stats-note">{text.closedOnly}</p>}
      {kind === 'survivors' && <p className="stats-note">{text.survivorsNote}</p>}
    </div>
  )
}

function RankingBody({ available, loading, rows, onOpen }: { available: boolean; loading: boolean; rows: Rows | null; onOpen?: (nickname: string) => void }) {
  if (!available) {
    return <p className="settings-hint">{esCloud.account.offline}</p>
  }
  if (loading) {
    return <Loading label={es.ranking.loading} />
  }
  if (rows === null) {
    return <p className="settings-hint" role="alert">{text.failed}</p>
  }
  if (rows.rows.length === 0) {
    return <p className="settings-hint">{text.empty}</p>
  }
  return <RankingTable rows={rows} onOpen={onOpen} />
}

/** «‹ Página 2 de 4 ›» y, si el jugador está en otra página, «Ir a mi posición». Nada con una sola página. */
function Pagination({ rows, onPage }: { rows: Rows; onPage: (page: number) => void }) {
  if (rows.pages <= 1) {
    return null
  }
  return (
    <nav className="ranking-pages" aria-label={text.pagesLabel}>
      <button type="button" className="ranking-arrow" aria-label={text.previousPage} disabled={rows.page <= 1} onClick={() => onPage(rows.page - 1)}>‹</button>
      <span className="ranking-page-number" aria-live="polite">{text.pageOf(rows.page, rows.pages)}</span>
      <button type="button" className="ranking-arrow" aria-label={text.nextPage} disabled={rows.page >= rows.pages} onClick={() => onPage(rows.page + 1)}>›</button>
      {rows.myPage !== null && rows.myPage !== rows.page && (
        <button type="button" className="btn btn-small ranking-mine" onClick={() => onPage(rows.myPage as number)}>{text.goToMine}</button>
      )}
    </nav>
  )
}


function RankingTable({ rows, onOpen }: { rows: Rows; onOpen?: (nickname: string) => void }) {
  return (
    <>
      <table className="ranking-table">
        <thead>
          <tr>
            <th scope="col" aria-label={text.position}>{text.positionShort}</th>
            <th scope="col">{text.player}</th>
            <th scope="col">{COLUMN[rows.kind]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.rows.map((row, index) => (
            <tr key={`${row.rank}-${row.nickname ?? index}`} className={row.me ? 'ranking-me' : undefined} aria-current={row.me ? 'true' : undefined}>
              <td>{row.rank ?? text.notPlayed}</td>
              <td className="ranking-player">
                <span className="ranking-player-line">
                  {onOpen && row.nickname && !row.me ? (
                    <button type="button" className="friend-open ranking-name" aria-label={text.openPlayer(row.nickname)} onClick={() => onOpen(row.nickname as string)}>{row.nickname}</button>
                  ) : (
                    <span className="ranking-name">{row.nickname ?? text.noName}</span>
                  )}
                  {row.verified && <VerifiedIcon className="ranking-verified" />}
                  {row.me && <span className="ranking-you">{text.you}</span>}
                </span>
              </td>
              <td>{'points' in row ? es.ranking.formatPoints(row.points) : 'streak' in row ? row.streak : (row.survivors ?? text.notPlayed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
