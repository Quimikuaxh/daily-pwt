import { lazy, Suspense, useState } from 'react'
import type { Account } from '../../cloud/account'
import { isPlayer, type AccountState } from '../../cloud/state'
import type { DayPoints } from '../../cloud/api'
import { TEAM_SIZE } from '../../core/constants'
import { es } from '../../i18n/es'
import type { DayRecord, GameStore } from '../../storage/gameStore'
import { computeStats } from '../../storage/playerStats'
import { Modal } from '../common/Modal'
import { ShareButton } from '../share/ShareButton'
import { shareTextFor } from '../share/shareText'
import { StatsPanel } from './StatsPanel'
import { Loading } from '../common/Loading'

// Fuera de la ruta crítica (E2E-21): solo se cargan al abrir su pestaña.
const RankingsPanel = lazy(() => import('./RankingsPanel').then((module) => ({ default: module.RankingsPanel })))
const FriendsPanel = lazy(() => import('./FriendsPanel').then((module) => ({ default: module.FriendsPanel })))

type StatsDialogProps = {
  store: GameStore
  /** Fecha del reto que se está viendo: con ella se decide si la racha de días sigue viva y si hay oficial de hoy que compartir. */
  today: string
  onClose: () => void
  /** F4: con cuenta configurada, pestañas de Rankings y Amigos (decisión de Jose: dentro de Estadísticas). */
  account?: Account
  accountState?: AccountState
}

type Tab = 'mine' | 'rankings' | 'friends'

/** Estadísticas sobre el historial de oficiales y, si el de hoy ya terminó, su botón de compartir; con cuenta, también rankings y amigos. */
export function StatsDialog({ store, today, onClose, account, accountState }: StatsDialogProps) {
  const [tab, setTab] = useState('mine' as Tab)
  const withAccount = Boolean(account && accountState && accountState.status !== 'disabled')
  const member = accountState?.status === 'signedIn'
  const pending = accountState && isPlayer(accountState) ? (accountState.summary?.incomingRequests ?? 0) : 0
  // RF-111: en «Amigos», una bolita naranja con las solicitudes pendientes (decisión de Jose, 28/10/2026; antes, «Amigos (2)»).
  const tabs: { id: Tab; label: string; badge?: number; accessibleName?: string }[] = [
    { id: 'mine', label: es.ranking.tabMine },
    { id: 'rankings', label: es.ranking.tabRankings },
    { id: 'friends', label: es.ranking.tabFriends, ...(pending > 0 && { badge: pending, accessibleName: es.ranking.tabFriendsPending(pending) }) },
  ]

  return (
    <Modal title={es.stats.title} onClose={onClose} className="stats-dialog">
      {withAccount && (
        <div className="stats-tabs" role="tablist" aria-label={es.stats.title}>
          {tabs.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              id={`stats-tab-${option.id}`}
              aria-selected={tab === option.id}
              aria-controls="stats-tabpanel"
              className="stats-tab"
              aria-label={option.accessibleName}
              onClick={() => setTab(option.id)}
            >
              {option.label}
              {option.badge !== undefined && <span className="tab-badge" aria-hidden="true">{option.badge}</span>}
            </button>
          ))}
        </div>
      )}
      <div id="stats-tabpanel" role={withAccount ? 'tabpanel' : undefined} aria-labelledby={withAccount ? `stats-tab-${tab}` : undefined}>
        {tab === 'mine' && <MyStats store={store} today={today} accountState={accountState} />}
        <Suspense fallback={<Loading label={es.ranking.loading} />}>
        {tab === 'rankings' && account && <RankingsPanel api={account.api} today={today} member={member} />}
        {tab === 'friends' && account &&
          (member && account.api ? (
            <FriendsPanel api={account.api} onChange={() => void account.refreshSummary()} />
          ) : (
            <p className="settings-hint">{es.friends.signIn}</p>
          ))}
        </Suspense>
      </div>
    </Modal>
  )
}

const pointsOfMonth = (points: DayPoints[], today: string) => points.filter((day) => day.date.startsWith(today.slice(0, 7))).reduce((total, day) => total + day.points, 0)

const finishedOn = (date: string) => (day: DayRecord) => day.date === date && (day.status === 'won' || day.status === 'lost')

function MyStats({ store, today, accountState }: { store: GameStore; today: string; accountState?: AccountState }) {
  const days = store.listDays()
  const stats = computeStats(days, today)
  const text = shareTextFor(days, today)
  const summary = accountState && isPlayer(accountState) ? accountState.summary : null
  const monthPoints = pointsOfMonth(summary?.points ?? [], today)
  // Los puntos de hoy no existen hasta el cierre del día (medianoche de Madrid): se enseña con cuántos Pokémon acabó el oficial.
  const todayRecord = days.find(finishedOn(today))

  return (
    <>
      {stats.played === 0 ? <p className="dialog-body">{es.stats.empty}</p> : <StatsPanel stats={stats} />}
      {summary && (
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
      {summary && todayRecord && <p className="stats-note">{es.ranking.todayPending}</p>}
      {summary && <p className="stats-note">{es.ranking.pointsHint}</p>}
      {text && <ShareButton text={text} />}
      <p className="stats-note">{accountState?.status === 'signedIn' ? es.stats.noteAccount : es.stats.note}</p>
    </>
  )
}
