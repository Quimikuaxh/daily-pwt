import type { ElementType } from 'react'
import type { GameData } from '../../core/types'
import { es } from '../../i18n/es'
import { Sprite } from '../common/Sprite'
import { speciesSprite } from '../common/spriteUrls'
import { TypeBadge } from '../common/TypeBadge'
import { TODAY_SPRITE_BOX, pokemonSpriteClass } from './spriteBox'
import type { CardModel } from './cardModel'

type MonHeadProps = { card: CardModel; data: GameData; headingAs?: ElementType }

/** Cabecera común de las tarjetas de Pokémon (tuyas y del rival): sprite, nombre, tipos en español, objeto y habilidad con su etiqueta. */
export function MonHead({ card, data, headingAs: Heading = 'h3' }: MonHeadProps) {
  return (
    <div className="mon-head">
      <div className="player-card-head">
        <Sprite src={speciesSprite(data.dex, card.speciesId, 'front')} name={card.nameEs} width={TODAY_SPRITE_BOX} height={TODAY_SPRITE_BOX} className={pokemonSpriteClass(data.dex.species[card.speciesId]?.spriteId)} />
        <div className="player-card-title">
          <Heading className="player-name" translate="no">{card.nameEs}</Heading>
          <div className="type-row" role="group" aria-label={es.today.types}>
            {card.types.map((type) => (
              <TypeBadge key={type.id} typeName={type.id} label={type.label} />
            ))}
          </div>
        </div>
      </div>
      <dl className="mon-facts">
        <div>
          <dt>{es.today.itemLabel}</dt>
          {' '}
          <dd>{card.itemName}</dd>
        </div>
        <div>
          <dt>{es.today.abilityLabel}</dt>
          {' '}
          <dd>{card.abilityName}</dd>
        </div>
      </dl>
    </div>
  )
}
