/** Iconos de píxel (9x9) de los botones de control del combate (RF-44c; Jose, 05/11/2026): salir, registro, velocidad y sonido. */
const PATHS = {
  exit: 'M0 0h5v1H0zM0 1h1v7H0zM0 8h5v1H0zM4 1h1v2H4zM4 6h1v2H4zM3 4h5v1H3zM6 2h1v1H6zM7 3h1v1H7zM7 5h1v1H7zM6 6h1v1H6z',
  history: 'M0 0h9v1H0zM0 1h1v7H0zM8 1h1v7H8zM0 8h9v1H0zM2 2h5v1H2zM2 4h5v1H2zM2 6h3v1H2z',
  speed: 'M0 1h1v7H0zM1 2h1v5H1zM2 3h1v3H2zM3 4h1v1H3zM4 1h1v7H4zM5 2h1v5H5zM6 3h1v3H6zM7 4h1v1H7z',
  sound: 'M0 3h2v3H0zM2 2h1v5H2zM3 1h1v7H3zM5 3h1v3H5zM6 1h1v1H6zM7 2h1v5H7zM6 7h1v1H6z',
} as const

export function ChromeIcon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="bt-chrome-icon" viewBox="0 0 9 9" width="18" height="18" shapeRendering="crispEdges" aria-hidden="true">
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  )
}
