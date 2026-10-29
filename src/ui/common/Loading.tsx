/**
 * Poké Ball en píxel (12 × 12) del indicador de carga: K borde, R mitad de arriba, W mitad de abajo y botón, H brillo.
 */
const BALL = [
  '....KKKK....',
  '..KKRRRRKK..',
  '.KRHRRRRRRK.',
  '.KHRRRRRRRK.',
  'KRRRKKKKRRRK',
  'KKKKKWWKKKKK',
  'KKKKKWWKKKKK',
  'KWWWKKKKWWWK',
  '.KWWWWWWWWK.',
  '.KWWWWWWWWK.',
  '..KKWWWWKK..',
  '....KKKK....',
]

const COLORS = { K: '#202020', R: '#e83030', W: '#f8f8f8', H: '#f8a8a8' } as const

/** Un trazo por color: un cuadrado de 1 × 1 por píxel. */
const PATHS = Object.entries(COLORS).map(([key, color]) => ({
  color,
  d: BALL.flatMap((row, y) => [...row].map((cell, x) => (cell === key ? `M${x} ${y}h1v1H${x}z` : ''))).join(''),
}))

/**
 * Indicador de carga de las ventanas que piden datos al servidor (Estadísticas, Rankings, Amigos, Historial, Cuenta): una Poké Ball que
 * gira a saltos de 90° (sin girar a ángulos intermedios, que emborronarían los píxeles) y el texto debajo. Uno solo para todas.
 */
export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <svg className="loading-ball" viewBox="0 0 12 12" width="36" height="36" aria-hidden="true" shapeRendering="crispEdges">
        {PATHS.map(({ color, d }) => (
          <path key={color} d={d} fill={color} />
        ))}
      </svg>
      <span>{label}</span>
    </div>
  )
}
