import { es } from '../../i18n/es'

/** Tick de verificado (RF-112, RF-96b): jugador con cuenta de Google. En píxel, como los iconos de la cabecera. */
export function VerifiedIcon({ className = 'verified-icon', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 8 8" width={size} height={size} role="img" aria-label={es.account.verified} shapeRendering="crispEdges">
      <title>{es.account.verified}</title>
      <path d="M2 0h4v1H2zM1 1h6v1H1zM0 2h8v4H0zM1 6h6v1H1zM2 7h4v1H2z" fill="#3888f8" />
      <path d="M5 2h1v1H5zM4 3h1v1H4zM1 3h1v1H1zM2 4h1v1H2zM3 4h1v1H3z" fill="#f8f8f8" />
    </svg>
  )
}
