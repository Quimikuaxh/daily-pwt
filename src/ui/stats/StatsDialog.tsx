import { lazy, Suspense, useState } from 'react'
import type { Account } from '../../cloud/account'
import { isPlayer, type AccountState } from '../../cloud/state'
import type { DayPoints } from '../../cloud/api'
import { es } from '../../i18n/es'
import type { GameStore } from '../../storage/gameStore'
import { computeStats } from '../../storage/playerStats'
import { Modal } from '../common/Modal'
import { ShareButton } from '../share/ShareButton'
import { shareTextFor } from '../share/shareText'
import { StatsPanel } from './StatsPanel'

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
  const tabs: { id: Tab; label: string }[] = [
    { id: 'mine', label: es.ranking.tabMine },
    { id: 'rankings', label: es.ranking.tabRankings },
    { id: 'friends', label: pending > 0 ? es.ranking.tabFriendsPending(pending) : es.ranking.tabFriends },
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
              className="btn btn-small settings-option"
              onClick={() => setTab(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <div id="stats-tabpanel" role={withAccount ? 'tabpanel' : undefined} aria-labelledby={withAccount ? `stats-tab-${tab}` : undefined}>
        {tab === 'mine' && <MyStats store={store} today={today} accountState={accountState} />}
        <Suspense fallback={<p className="settings-hint" role="status">{es.ranking.loading}</p>}>
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
const isOn = (date: string) => (day: DayPoints) => day.date === date

function MyStats({ store, today, accountState }: { store: GameStore; today: string; accountState?: AccountState }) {
  const days = store.listDays()
  const stats = computeStats(days, today)
  const text = shareTextFor(days, today)
  const summary = accountState && isPlayer(accountState) ? accountState.summary : null
  const monthPoints = pointsOfMonth(summary?.points ?? [], today)
  const todayPoints = summary?.points.find(isOn(today))

  return (
    <>
      {stats.played === 0 ? <p className="dialog-body">{es.stats.empty}</p> : <StatsPanel stats={stats} />}
      {summary && (
        <dl className="stats-totals stats-points">
          <div className="stats-cell">
            <dt>{es.ranking.monthPoints}</dt>
            <dd data-testid="stats-month-points">{es.ranking.formatPoints(monthPoints)}</dd>
          </div>
          {todayPoints && (
            <div className="stats-cell">
              <dt>{es.ranking.todayPoints}</dt>
              <dd data-testid="stats-today-points">
                {es.ranking.formatPoints(todayPoints.points)}
                {todayPoints.provisional && <small className="stats-provisional"> ({es.ranking.provisionalMark})</small>}
              </dd>
            </div>
          )}
        </dl>
      )}
      {summary && <p className="stats-note">{es.ranking.pointsHint}</p>}
      {text && <ShareButton text={text} />}
      <p className="stats-note">{accountState?.status === 'signedIn' ? es.stats.noteAccount : es.stats.note}</p>
    </>
  )
}
