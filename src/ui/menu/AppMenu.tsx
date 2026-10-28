import { lazy, Suspense, useState } from 'react'
import type { Account } from '../../cloud/account'
import type { AccountState } from '../../cloud/state'
import { es } from '../../i18n/es'
import type { GameStore } from '../../storage/gameStore'
import type { Settings } from '../../storage/settings'

// Las ventanas solo hacen falta al abrirlas: fuera de la ruta crítica (E2E-21).
const StatsDialog = lazy(() => import('../stats/StatsDialog').then((module) => ({ default: module.StatsDialog })))
const HelpDialog = lazy(() => import('./HelpDialog').then((module) => ({ default: module.HelpDialog })))
const SettingsDialog = lazy(() => import('./SettingsDialog').then((module) => ({ default: module.SettingsDialog })))

/** Iconos en píxel (escala 2 exacta), al estilo de los de menú del juego. */
function StatsIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 11 10" width="22" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M0 6h3v4H0zM4 3h3v7H4zM8 0h3v10H8z" fill="currentColor" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 7 10" width="14" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M1 0h5v1H1zM0 1h2v2H0zM5 1h2v3H5zM4 4h2v1H4zM3 5h2v2H3zM3 8h2v2H3z" fill="currentColor" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 10 10" width="20" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M4 0h2v2H4zM4 8h2v2H4zM0 4h2v2H0zM8 4h2v2H8zM1 1h2v2H1zM7 1h2v2H7zM1 7h2v2H1zM7 7h2v2H7zM2 2h6v6H2z" fill="currentColor" />
      <path d="M4 4h2v2H4z" fill="var(--icon-hole, #383838)" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 10 10" width="20" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M3 0h4v1H3zM2 1h6v4H2zM3 5h4v1H3zM1 7h8v1H1zM0 8h10v2H0z" fill="currentColor" />
    </svg>
  )
}

/** «Iniciar sesión» de la cabecera: icono y, en pantallas anchas, también el texto. */
function HeaderSignIn({ account }: { account: Account }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-small header-action header-sign-in"
      aria-label={es.account.signIn}
      title={es.account.signIn}
      disabled={busy}
      onClick={() => {
        setBusy(true)
        account.signIn().catch(() => setBusy(false))
      }}
    >
      <AccountIcon />
      <span className="header-sign-in-text" aria-hidden="true">{busy ? es.account.signingIn : es.account.signInShort}</span>
    </button>
  )
}

export type AppMenuProps = {
  store: GameStore
  /** Fecha del reto que se está viendo (rachas vivas y oficial de hoy que compartir). */
  today: string
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onClearData: () => void
  /** Cuenta y rankings (F4). Sin ellos, el menú es el de antes: solo local. */
  account?: Account
  accountState?: AccountState
  /** RF-93: botón de iniciar sesión en la cabecera (solo en Hoy). */
  signIn?: boolean
}

/** Lo que el menú necesita de App; la fecha la pone cada pantalla. */
export type MenuContext = Omit<AppMenuProps, 'today' | 'signIn'>

type Open = 'stats' | 'help' | 'settings' | null

/** Accesos de la cabecera de Hoy y de Resultado: Estadísticas, Ayuda y Ajustes, con sus ventanas. */
export function AppMenu({ store, today, settings, onSettingsChange, onClearData, account, accountState, signIn = false }: AppMenuProps) {
  const [open, setOpen] = useState(null as Open)
  const close = () => setOpen(null)
  // RF-111: aviso en la cabecera si hay solicitudes de amistad pendientes.
  const pending = accountState?.status === 'signedIn' ? (accountState.summary?.incomingRequests ?? 0) : 0
  const buttons = [
    { id: 'stats' as const, label: es.stats.open, icon: <StatsIcon /> },
    { id: 'help' as const, label: es.help.open, icon: <HelpIcon /> },
    { id: 'settings' as const, label: es.settings.open, icon: <SettingsIcon /> },
  ]

  return (
    <>
      <nav className="header-actions" aria-label={es.app.headerActions}>
        {signIn && account && accountState?.status === 'guest' && <HeaderSignIn account={account} />}
        {buttons.map((button) => (
          <button key={button.id} type="button" className="btn btn-small header-action" onClick={() => setOpen(button.id)} aria-label={button.label} title={button.label}>
            {button.icon}
            {button.id === 'stats' && pending > 0 && (
              <span className="header-badge" role="status" aria-label={es.friends.pendingBadge(pending)}>{pending}</span>
            )}
          </button>
        ))}
      </nav>
      <Suspense fallback={null}>
      {open === 'stats' && <StatsDialog store={store} today={today} onClose={close} account={account} accountState={accountState} />}
      {open === 'help' && <HelpDialog onClose={close} />}
      {open === 'settings' && <SettingsDialog settings={settings} onChange={onSettingsChange} onClearData={onClearData} onClose={close} account={account} accountState={accountState} />}
      </Suspense>
    </>
  )
}
