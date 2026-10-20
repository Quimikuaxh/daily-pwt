import type { CSSProperties } from 'react'
import { es } from '../../i18n/es'
import { CategoryIcon } from '../common/CategoryIcon'
import { TypeBadge } from '../common/TypeBadge'
import { moveTileColor } from '../battle/moveTileColors'
import type { MoveModel } from './cardModel'

/**
 * Los 4 movimientos como filas de rejilla fija: nombre y chip de tipo (ancho fijo, siempre en la misma columna) y debajo categoría con
 * su icono, potencia y precisión en columnas alineadas entre filas y tarjetas. Los usan las tarjetas del jugador y los detalles del rival.
 */
export function MoveList({ moves, label }: { moves: MoveModel[]; label?: string }) {
  return (
    <ul className="move-list" aria-label={label}>
      {moves.map((move, index) => (
        <li key={`${move.id}-${index}`} className="move-row" style={{ '--move-color': moveTileColor(move.typeName) } as CSSProperties}>
          <span className="move-name">{move.name}</span>
          <span className="move-type">{move.typeName && move.typeLabel && <TypeBadge typeName={move.typeName} label={move.typeLabel} />}</span>
          <span className="move-stats">
            <span className="move-stat move-category">
              {move.category && <CategoryIcon category={move.category} />}
              {move.categoryLabel}
            </span>
            {' '}
            <span className="move-stat">
              {es.today.power} <span className="move-number">{move.power}</span>
            </span>
            {' '}
            <span className="move-stat">
              {es.today.accuracy} <span className="move-number">{move.accuracy}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
