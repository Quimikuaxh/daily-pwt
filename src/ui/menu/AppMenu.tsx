import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Account } from '../../cloud/account'
import { welcomeNeeds, type AccountState } from '../../cloud/state'
import type { HistoryItem } from '../../cloud/api'
import type { HistoryArt } from '../replay/historyArt'
import { es } from '../../i18n/es'
import { VerifiedIcon } from '../common/VerifiedIcon'
import type { GameStore } from '../../storage/gameStore'
import type { Settings } from '../../storage/settings'
import { browserStorage } from '../../storage/browserStorage'
import { dismissWelcomeForever, markWelcomeShown, welcomeDue } from '../../storage/welcomePrompt'

// Las ventanas solo hacen falta al abrirlas: fuera de la ruta crítica (E2E-21).
const StatsDialog = lazy(() => import('../stats/StatsDialog').then((module) => ({ default: module.StatsDialog })))
const HelpDialog = lazy(() => import('./HelpDialog').then((module) => ({ default: module.HelpDialog })))
const SettingsDialog = lazy(() => import('./SettingsDialog').then((module) => ({ default: module.SettingsDialog })))
const AccountDialog = lazy(() => import('../account/AccountSection').then((module) => ({ default: module.AccountDialog })))
const WelcomePrompt = lazy(() => import('../account/WelcomePrompt').then((module) => ({ default: module.WelcomePrompt })))
const MatchHistoryDialog = lazy(() => import('../replay/replayModule').then((module) => ({ default: module.MatchHistoryDialog })))

function HistoryIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 10 10" width="20" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M3 0h4v1H3zM1 1h2v1H1zM7 1h2v1H7zM0 2h1v6H0zM9 2h1v6H9zM1 8h2v1H1zM7 8h2v1H7zM3 9h4v1H3zM4 2h1v4H4zM5 5h2v1H5z" fill="currentColor" />
    </svg>
  )
}

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
  /** F5: nombre del rival (historial) y abrir una repetición del historial. Sin ellos no hay historial. */
  trainerName?: (trainerId: string) => string
  onWatchReplay?: (date: string) => void
  /** Sprite del rival y equipo (los `spriteId` de los 6) de un combate del historial; `null` si los datos ya no dan ese reto. */
  historyArt?: (item: HistoryItem) => HistoryArt | null
  /** Abrir una repetición del historial de un amigo (desde Estadísticas › Amigos). */
  onWatchFriendReplay?: (nickname: string, date: string) => void
  /** Solo en Hoy: aviso para elegir nombre e iniciar sesión (RF-94b), como mucho una vez al día. */
  welcome?: boolean
}

/** Lo que el menú necesita de App; la fecha la pone cada pantalla. */
export type MenuContext = Omit<AppMenuProps, 'today'>

type Open = 'account' | 'history' | 'stats' | 'help' | 'settings' | 'welcome' | null

/**
 * Accesos de la cabecera de Hoy y de Resultado: Cuenta (con Supabase configurado; RF-93, decisión de Jose del 28/10/2026), Estadísticas,
 * Ayuda y Ajustes, con sus ventanas.
 */
export function AppMenu({ store, today, settings, onSettingsChange, onClearData, account, accountState, trainerName, onWatchReplay, historyArt, onWatchFriendReplay, welcome = false }: AppMenuProps) {
  const [open, setOpen] = useState(null as Open)
  const close = () => setOpen(null)
  // RF-94b: a quien no ha elegido nombre o juega sin cuenta, al entrar en Hoy, como mucho una vez al día y salvo «No volver a mostrar».
  const needs = welcome && account ? welcomeNeeds(accountState) : null
  const welcomeChecked = useRef(false)
  useEffect(() => {
    if (!needs || welcomeChecked.current || open !== null) return
    welcomeChecked.current = true
    if (!welcomeDue(browserStorage(), today)) return
    markWelcomeShown(browserStorage(), today)
    // Se abre al llegar el resumen de la cuenta (asíncrono), no al pintar: por eso va en un efecto y una sola vez (`welcomeChecked`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen('welcome')
  }, [needs, today, open])
  // RF-111: aviso en la cabecera si hay solicitudes de amistad pendientes.
  const pending = accountState?.status === 'signedIn' ? (accountState.summary?.incomingRequests ?? 0) : 0
  const withAccount = account && accountState && accountState.status !== 'disabled'
  const withHistory = withAccount && trainerName && onWatchReplay
  // RF-96b: con cuenta de Google, el icono Cuenta lleva el tick y, en pantallas anchas, el nickname al lado.
  const signedInAs = accountState?.status === 'signedIn' ? accountState.nickname : null
  const buttons = [
    ...(withAccount
      ? [{
          id: 'account' as const,
          label: signedInAs ? es.account.openSignedIn(signedInAs) : es.account.open,
          icon: signedInAs ? (
            <>
              <AccountIcon />
              <span className="header-nickname" aria-hidden="true">{signedInAs}</span>
              <VerifiedIcon className="header-verified" size={14} />
            </>
          ) : (
            <AccountIcon />
          ),
        }]
      : []),
    // RF-124: en el móvil no cabe; allí se abre desde Cuenta.
    ...(withHistory ? [{ id: 'history' as const, label: es.history.open, icon: <HistoryIcon />, wideOnly: true }] : []),
    // Con solicitudes pendientes, un puntito rojo sin número (decisión de Jose, 29/10/2026): el número lo dice el nombre del botón.
    { id: 'stats' as const, label: pending ? es.stats.openPending(pending) : es.stats.open, icon: <StatsIcon /> },
    { id: 'help' as const, label: es.help.open, icon: <HelpIcon /> },
    { id: 'settings' as const, label: es.settings.open, icon: <SettingsIcon /> },
  ]

  return (
    <>
      <nav className="header-actions" aria-label={es.app.headerActions}>
        {buttons.map((button) => (
          <button key={button.id} type="button" className={`btn btn-small header-action${'wideOnly' in button ? ' header-action-wide' : ''}${button.id === 'account' && signedInAs ? ' header-account' : ''}`} onClick={() => setOpen(button.id)} aria-label={button.label} title={button.label}>
            {button.icon}
            {button.id === 'stats' && pending > 0 && (
              <span className="header-badge" aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>
      <Suspense fallback={null}>
      {open === 'welcome' && needs && (
        <WelcomePrompt
          needs={needs}
          nickname={accountState && 'nickname' in accountState ? accountState.nickname : null}
          onOpenAccount={() => setOpen('account')}
          onClose={(never) => {
            if (never) dismissWelcomeForever(browserStorage())
            setOpen((current) => (current === 'welcome' ? null : current))
          }}
        />
      )}
      {open === 'account' && account && accountState && <AccountDialog account={account} state={accountState} onClose={close} onOpenHistory={withHistory ? () => setOpen('history') : undefined} />}
      {open === 'history' && account && trainerName && onWatchReplay && (
        <MatchHistoryDialog
          api={account.api}
          trainerName={trainerName}
          art={historyArt}
          onWatch={(date) => {
            close()
            onWatchReplay(date)
          }}
          onClose={close}
        />
      )}
      {open === 'stats' && (
        <StatsDialog
          store={store}
          today={today}
          onClose={close}
          account={account}
          accountState={accountState}
          trainerName={trainerName}
          historyArt={historyArt}
          onWatchFriendReplay={
            onWatchFriendReplay &&
            ((nickname, date) => {
              close()
              onWatchFriendReplay(nickname, date)
            })
          }
        />
      )}
      {open === 'help' && <HelpDialog onClose={close} />}
      {open === 'settings' && <SettingsDialog settings={settings} onChange={onSettingsChange} onClearData={onClearData} onClose={close} accountState={accountState} />}
      </Suspense>
    </>
  )
}
