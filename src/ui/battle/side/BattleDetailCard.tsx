import type { ReactNode } from 'react'
import descriptions from '../../../generated/descriptions-es.json'
import { es } from '../../../i18n/es'
import { CategoryIcon } from '../../common/CategoryIcon'
import { TypeBadge } from '../../common/TypeBadge'
import { itemIconUrl } from '../../common/spriteUrls'
import type { MoveModel } from '../../today/cardModel'
import { factValueClass } from './sideModel'
import './side.css'

type Texts = Record<string, string | undefined>
const descriptionTable = descriptions as { moves: Texts; abilities: Texts; items: Texts }
const text = es.battle.side

export type BattleDetail = { kind: 'move'; move: MoveModel } | { kind: 'item' | 'ability'; id: string; name: string; description?: string }

/** La misma ficha de movimiento, objeto o habilidad en Hoy y los paneles de combate. */
export function BattleDetailCard({ detail, children, announce = true }: { detail: BattleDetail; children?: ReactNode; announce?: boolean }) {
  const live = announce ? 'polite' : undefined
  if (detail.kind !== 'move') {
    const description = detail.description ?? (detail.kind === 'item' ? descriptionTable.items[detail.id] : descriptionTable.abilities[detail.id])
    const icon = detail.kind === 'item' && detail.id ? itemIconUrl(detail.id) : null
    return (
      <section className="bt-side-info" data-icon={icon ? 'true' : undefined} aria-live={live}>
        {icon && (
          <span className="bt-side-item-icon">
            <img src={icon} alt="" width={30} height={30} />
          </span>
        )}
        <div className="bt-side-info-body">
          <header className="bt-side-info-head">
            <span className="bt-side-kind">{text.kinds[detail.kind]}</span>
            <h3>{detail.name}</h3>
          </header>
          <p>{description ?? text.noDescription}</p>
        </div>
      </section>
    )
  }

  const { move } = detail
  const summary = es.battle.summary
  return (
    <section className="bt-side-info" aria-live={live}>
      <header className="bt-side-info-head">
        <h3>{move.name}</h3>
        {move.typeName && <TypeBadge typeName={move.typeName} label={move.typeLabel ?? move.typeName} />}
      </header>
      <dl className="bt-side-move-facts">
        <div>
          <dt>{summary.category}</dt>
          <dd>
            {move.category && <CategoryIcon category={move.category} />}
            {move.categoryLabel}
          </dd>
        </div>
        <div>
          <dt>{summary.power}</dt>
          <dd className={factValueClass(move.power)}>{move.power}</dd>
        </div>
        <div>
          <dt>{summary.accuracy}</dt>
          <dd className={factValueClass(move.accuracy)}>{move.accuracy}</dd>
        </div>
        <div>
          <dt>{summary.pp}</dt>
          <dd className={factValueClass(move.maxPp)}>{move.maxPp ?? es.today.notApplicable}</dd>
        </div>
      </dl>
      <p>{descriptionTable.moves[move.id] ?? text.noDescription}</p>
      {children}
    </section>
  )
}
