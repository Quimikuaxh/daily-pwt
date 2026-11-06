import type { SideView } from '../../battle/protocol'
import { es } from '../../i18n/es'

type RemainingIndicatorProps = {
  side: SideView
  label: string
  testId: string
  /** Las Poké Balls antes del nombre (el rival): las de los dos quedan juntas en el centro (Jose, 06/11/2026). */
  ballsFirst?: boolean
}

/**
 * Poké Ball por Pokémon. El recuento («4/6») ya no se ve (Jose, 06/11/2026), pero sigue para el lector de pantalla: el estado no depende del
 * color.
 */
export function RemainingIndicator({ side, label, testId, ballsFirst = false }: RemainingIndicatorProps) {
  return (
    <p data-testid={testId} className="bt-remaining">
      {ballsFirst && <Balls side={side} />}
      <span className="bt-remaining-label">{label}</span>
      {!ballsFirst && <Balls side={side} />}
      <span className="sr-only">{es.battle.remaining(side.remaining, side.team.length)}</span>
    </p>
  )
}

function Balls({ side }: { side: SideView }) {
  return (
    <span className="bt-balls" aria-hidden="true">
      {side.team.map((mon, index) => (
        <span key={index} className={mon.fainted ? 'bt-ball-dot bt-ball-fainted' : 'bt-ball-dot'} />
      ))}
    </span>
  )
}
