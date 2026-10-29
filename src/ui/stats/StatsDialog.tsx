import { lazy, Suspense, useState } from 'react'
import type { Account } from '../../cloud/account'
import type { HistoryItem } from '../../cloud/api'
import type { HistoryArt } from '../replay/historyArt'
import { isPlayer, type AccountState } from '../../cloud/state'
import { es } from '../../i18n/es'
import type { GameStore } from '../../storage/gameStore'
import { Modal } from '../common/Modal'
import { StatsSummary } from './StatsSummary'
import { Loading } from '../common/Loading'

// Fuera de la ruta crítica (E2E-21): solo se cargan al abrir su pestaña.
const RankingsPanel = lazy(() => import('./RankingsPanel').then((module) => ({ default: module.RankingsPanel })))
const FriendsPanel = lazy(() => import('./FriendsPanel').then((module) => ({ default: module.FriendsPanel })))
const FriendView = lazy(() => import('./FriendView').then((module) => ({ default: module.FriendView })))

type StatsDialogProps = {
  store: GameStore
  /** Fecha del reto que se está viendo: con ella se decide si la racha de días sigue viva y si hay oficial de hoy que compartir. */
  today: string
  onClose: () => void
  /** F4: con cuenta configurada, pestañas de Rankings y Amigos (decisión de Jose: dentro de Estadísticas). */
  account?: Account
  accountState?: AccountState
  /** Historial de un amigo con sus repeticiones (decisión de Jose, 29/10/2026). Sin ellos, de un amigo solo se ven sus estadísticas. */
  trainerName?: (trainerId: string) => string
  historyArt?: (item: HistoryItem) => HistoryArt | null
  onWatchFriendReplay?: (nickname: string, date: string) => void
}

type Tab = 'mine' | 'rankings' | 'friends'

/** Estadísticas sobre el historial de oficiales y, si el de hoy ya terminó, su botón de compartir; con cuenta, también rankings y amigos. */
export function StatsDialog({ store, today, onClose, account, accountState, trainerName, historyArt, onWatchFriendReplay }: StatsDialogProps) {
  const [tab, setTab] = useState('mine' as Tab)
  // Amigo abierto en la pestaña Amigos; al cambiar de pestaña se vuelve a la lista.
  const [friend, setFriend] = useState(null as string | null)
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
              onClick={() => {
                setTab(option.id)
                setFriend(null)
              }}
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
            friend ? (
              <FriendView api={account.api} nickname={friend} today={today} onBack={() => setFriend(null)} trainerName={trainerName} art={historyArt} onWatch={onWatchFriendReplay} />
            ) : (
              <FriendsPanel api={account.api} onChange={() => void account.refreshSummary()} onOpen={setFriend} />
            )
          ) : (
            <p className="settings-hint">{es.friends.signIn}</p>
          ))}
        </Suspense>
      </div>
    </Modal>
  )
}

function MyStats({ store, today, accountState }: { store: GameStore; today: string; accountState?: AccountState }) {
  const summary = accountState && isPlayer(accountState) ? accountState.summary : null
  return (
    <StatsSummary
      days={store.listDays()}
      today={today}
      points={summary?.points ?? null}
      own
      note={accountState?.status === 'signedIn' ? es.stats.noteAccount : es.stats.note}
    />
  )
}
