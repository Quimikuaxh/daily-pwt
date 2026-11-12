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
import { discordResultFrom, withoutDiscordParam } from '../../cloud/discordLink'
import { dismissWelcomeForever, markWelcomeShown, welcomeDue } from '../../storage/welcomePrompt'

// Las ventanas solo hacen falta al abrirlas: fuera de la ruta crítica (E2E-21).
const StatsDialog = lazy(() => import('../stats/StatsDialog').then((module) => ({ default: module.StatsDialog })))
const ModesDialog = lazy(() => import('./ModesDialog').then((module) => ({ default: module.ModesDialog })))
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

/** Mando en píxel para Modos de juego. */
function ModesIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 12 8" width="24" height="16" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M2 0h8v1h1v1h1v5h-1v1H8V7H4v1H1V7H0V2h1V1h1z" fill="currentColor" />
      <path d="M3 2h1v1h1v1H4v1H3V4H2V3h1zM8 2h1v1H8zM9 3h1v1H9zM7 3h1v1H7zM8 4h1v1H8z" fill="var(--icon-hole, #383838)" />
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
  /** Otros modos de juego del menú Modos (de momento, la campaña Nuzlocke de Hoenn). Sin él, Modos solo enseña el reto diario. */
  modes?: readonly { id: string; label: string; hint: string; onOpen: () => void; prefetch?: () => void }[]
  /** Directo (RF-111c): ver el oficial en curso de un amigo. */
  onWatchLive?: (nickname: string) => void
  /** Solo en Hoy: aviso para elegir nombre e iniciar sesión (RF-94b), como mucho una vez al día. */
  welcome?: boolean
}

/** Lo que el menú necesita de App; la fecha la pone cada pantalla. */
export type MenuContext = Omit<AppMenuProps, 'today'>

type Open = 'account' | 'history' | 'stats' | 'help' | 'modes' | 'settings' | 'welcome' | null

/**
 * Accesos de la cabecera de Hoy y de Resultado: Cuenta (con Supabase configurado; RF-93, decisión de Jose del 28/10/2026), Estadísticas,
 * Ayuda y Ajustes, con sus ventanas.
 */
export function AppMenu({ store, today, settings, onSettingsChange, onClearData, account, accountState, trainerName, onWatchReplay, historyArt, onWatchFriendReplay, onWatchLive, welcome = false, modes = [] }: AppMenuProps) {
  // RF-115: al volver de conectar Discord (`?discord=`), Cuenta se abre con el resultado y el parámetro se quita de la dirección.
  const [discordResult] = useState(() => discordResultFrom(window.location.search))
  const [open, setOpen] = useState((discordResult ? 'account' : null) as Open)
  useEffect(() => {
    if (discordResult) window.history.replaceState(null, '', withoutDiscordParam(window.location.href))
  }, [discordResult])
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
    { id: 'modes' as const, label: es.modes.open, icon: <ModesIcon /> },
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
      {open === 'account' && account && accountState && <AccountDialog account={account} state={accountState} discordResult={discordResult} onClose={close} onOpenHistory={withHistory ? () => setOpen('history') : undefined} />}
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
          onWatchLive={
            onWatchLive &&
            ((nickname) => {
              close()
              onWatchLive(nickname)
            })
          }
          onWatchFriendReplay={
            onWatchFriendReplay &&
            ((nickname, date) => {
              close()
              onWatchFriendReplay(nickname, date)
            })
          }
        />
      )}
      {open === 'help' && <HelpDialog onClose={() => setOpen('settings')} />}
      {open === 'modes' && <ModesDialog modes={modes} onClose={close} />}
      {open === 'settings' && <SettingsDialog settings={settings} onChange={onSettingsChange} onClearData={onClearData} onClose={close} accountState={accountState} onOpenHelp={() => setOpen('help')} />}
      </Suspense>
    </>
  )
}
