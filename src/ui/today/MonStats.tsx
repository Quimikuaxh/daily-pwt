import { es } from '../../i18n/es'
import { STAT_KEYS, type CardModel } from './cardModel'

/** Suma de base y estadísticas a nivel 50 de un Pokémon de Hoy: en las tarjetas del jugador y en el detalle del rival (Jose, 03/11/2026). */
export function MonStats({ card }: { card: CardModel }) {
  return (
    <>
      <p className="base-total">{es.today.baseStatTotal(card.baseStatTotal)}</p>
      <dl className="stat-grid" aria-label={es.today.statsTitle}>
        {STAT_KEYS.map((key) => (
          <div key={key} className="stat-cell">
            <dt>{es.today.statNames[key]}</dt>
            {' '}
            <dd>{card.stats[key]}</dd>
            {' '}
          </div>
        ))}
      </dl>
    </>
  )
}
