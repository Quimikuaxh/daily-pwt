import type { SideView } from '../../battle/protocol'
import { es } from '../../i18n/es'

type RemainingIndicatorProps = { side: SideView; label: string; testId: string }

/** Pokéball por Pokémon más el recuento en texto: el estado no depende del color. */
export function RemainingIndicator({ side, label, testId }: RemainingIndicatorProps) {
  return (
    <p data-testid={testId} className="bt-remaining">
      <span className="bt-remaining-label">{label}</span>
      <span className="bt-balls" aria-hidden="true">
        {side.team.map((mon, index) => (
          <span key={index} className={mon.fainted ? 'bt-ball-dot bt-ball-fainted' : 'bt-ball-dot'} />
        ))}
      </span>
      <span className="bt-remaining-count">{es.battle.remaining(side.remaining, side.team.length)}</span>
    </p>
  )
}
