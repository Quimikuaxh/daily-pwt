import type { CSSProperties } from 'react'
import type { GameData, ResolvedSet } from '../../core/types'
import { es } from '../../i18n/es'
import { cardModel, STAT_KEYS } from './cardModel'
import { moveTileColor } from '../battle/moveTileColors'
import { MonHead } from './MonHead'
import { MoveList } from './MoveList'

type PlayerCardProps = {
  set: ResolvedSet
  data: GameData
  isLead: boolean
  onChooseLead: () => void
}


export function PlayerCard({ set, data, isLead, onChooseLead }: PlayerCardProps) {
  const card = cardModel(set, data)

  return (
    <article className={isLead ? 'player-card plate player-card-lead' : 'player-card plate'} style={{ '--type-edge': moveTileColor(card.types[0]?.id ?? null) } as CSSProperties}>
      <MonHead card={card} data={data} />

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

      <MoveList moves={card.moves} />

      <button type="button" className={isLead ? 'btn btn-primary btn-lead' : 'btn btn-secondary btn-lead'} aria-pressed={isLead} onClick={onChooseLead}>
        {isLead ? es.today.leadSelected : es.today.leadButton}
        <span className="sr-only">{` ${card.nameEs}`}</span>
      </button>
    </article>
  )
}
