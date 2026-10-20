import { useId, useState } from 'react'
import type { Challenge, GameData } from '../../core/types'
import { es } from '../../i18n/es'
import { Sprite } from '../common/Sprite'
import { speciesSprite, trainerSprite } from '../common/spriteUrls'
import { TypeBadge } from '../common/TypeBadge'
import { TODAY_SPRITE_BOX, TODAY_SPRITE_CLASS } from './spriteBox'
import { cardModel } from './cardModel'
import { MonHead } from './MonHead'
import { MoveList } from './MoveList'

type RivalSectionProps = { challenge: Challenge; data: GameData }


function RivalCard({ challenge, data }: RivalSectionProps) {
  const { trainer } = challenge
  const specialty = trainer.specialtyType
  return (
    <div className="rival-card">
      <div className="rival-stage">
        <Sprite src={trainerSprite(trainer.sprite)} name={trainer.nameEs} width={TODAY_SPRITE_BOX} height={TODAY_SPRITE_BOX} className={TODAY_SPRITE_CLASS} />
      </div>
      <div className="rival-card-text">
        <p className="rival-name" translate="no">{trainer.nameEs}</p>
        <p className="rival-meta">
          {trainer.category === 'champion' ? es.today.categories.champion[trainer.gender] : es.today.categories.leader}
          {trainer.region ? ` · ${es.today.regions[trainer.region]}` : ''}
        </p>
        {specialty && (
          <p className="rival-meta">
            {es.today.specialty(data.names.types[specialty] ?? specialty)}{' '}
            <TypeBadge typeName={specialty} label={data.names.types[specialty] ?? specialty} />
          </p>
        )}
      </div>
    </div>
  )
}

/** Detalle de un Pokémon del rival (RF-34): mismo formato que las tarjetas del jugador, pero solo con la habilidad elegida del día y sin estadísticas. */
function RivalMonDetails({ set, data }: { set: Challenge['rivalTeam'][number]; data: GameData }) {
  const card = cardModel(set, data)
  return (
    <div className="rival-mon-details">
      <MonHead card={card} data={data} headingAs="h4" />
      <MoveList moves={card.moves} label={es.today.moves} />
    </div>
  )
}

export function RivalSection({ challenge, data }: RivalSectionProps) {
  const headingId = useId()
  const teamId = useId()
  const [showDetails, setShowDetails] = useState(false)

  return (
    <section aria-labelledby={headingId} className="panel plate">
      <h2 id={headingId} className="section-title">{es.today.rivalSection}</h2>
      <RivalCard challenge={challenge} data={data} />

      <h3 className="subsection-title">{es.today.rivalTeam}</h3>
      <ul id={teamId} className="rival-team" data-detailed={showDetails ? "true" : undefined}>
        {challenge.rivalTeam.map((set, index) => (
          <li key={`${set.species}-${index}`} className={showDetails ? "rival-mon rival-mon-detailed plate" : "rival-mon plate"}>
            {showDetails ? (
              <RivalMonDetails set={set} data={data} />
            ) : (
              <>
                <Sprite src={speciesSprite(data.dex, set.species, 'front')} name={set.nameEs} width={TODAY_SPRITE_BOX} height={TODAY_SPRITE_BOX} className={TODAY_SPRITE_CLASS} />
                <span className="rival-mon-name" translate="no">{set.nameEs}</span>
              </>
            )}
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-secondary" aria-expanded={showDetails} aria-controls={teamId} onClick={() => setShowDetails((open) => !open)}>
        {es.today.toggleRivalDetails}
      </button>
    </section>
  )
}
