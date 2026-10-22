import { es } from '../../i18n/es'

/** Barras en píxel, al estilo de los iconos de menú del juego. */
function StatsIcon() {
  return (
    <svg className="header-icon" viewBox="0 0 11 10" width="22" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M0 6h3v4H0zM4 3h3v7H4zM8 0h3v10H8z" fill="currentColor" />
    </svg>
  )
}

type HeaderActionsProps = { onOpenStats: () => void }

/** Accesos de la cabecera (Hoy y Resultado). */
export function HeaderActions({ onOpenStats }: HeaderActionsProps) {
  return (
    <nav className="header-actions" aria-label={es.app.headerActions}>
      <button type="button" className="btn btn-small header-action" onClick={onOpenStats} aria-label={es.stats.open} title={es.stats.open}>
        <StatsIcon />
      </button>
    </nav>
  )
}
