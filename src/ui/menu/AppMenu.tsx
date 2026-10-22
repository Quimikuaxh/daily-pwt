import { useState } from 'react'
import { es } from '../../i18n/es'
import type { GameStore } from '../../storage/gameStore'
import type { Settings } from '../../storage/settings'
import { StatsDialog } from '../stats/StatsDialog'
import { HelpDialog } from './HelpDialog'
import { SettingsDialog } from './SettingsDialog'

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

export type AppMenuProps = {
  store: GameStore
  /** Fecha del reto que se está viendo (rachas vivas y oficial de hoy que compartir). */
  today: string
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onClearData: () => void
}

/** Lo que el menú necesita de App; la fecha la pone cada pantalla. */
export type MenuContext = Omit<AppMenuProps, 'today'>

type Open = 'stats' | 'help' | 'settings' | null

/** Accesos de la cabecera de Hoy y de Resultado: Estadísticas, Ayuda y Ajustes, con sus ventanas. */
export function AppMenu({ store, today, settings, onSettingsChange, onClearData }: AppMenuProps) {
  const [open, setOpen] = useState(null as Open)
  const close = () => setOpen(null)
  const buttons = [
    { id: 'stats' as const, label: es.stats.open, icon: <StatsIcon /> },
    { id: 'help' as const, label: es.help.open, icon: <HelpIcon /> },
    { id: 'settings' as const, label: es.settings.open, icon: <SettingsIcon /> },
  ]

  return (
    <>
      <nav className="header-actions" aria-label={es.app.headerActions}>
        {buttons.map((button) => (
          <button key={button.id} type="button" className="btn btn-small header-action" onClick={() => setOpen(button.id)} aria-label={button.label} title={button.label}>
            {button.icon}
          </button>
        ))}
      </nav>
      {open === 'stats' && <StatsDialog store={store} today={today} onClose={close} />}
      {open === 'help' && <HelpDialog onClose={close} />}
      {open === 'settings' && <SettingsDialog settings={settings} onChange={onSettingsChange} onClearData={onClearData} onClose={close} />}
    </>
  )
}
