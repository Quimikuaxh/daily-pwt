import type { BattleView, MonView } from '../../battle/protocol'
import type { Challenge, GameData } from '../../core/types'
import type { IntroPhase, SwitchAnimation } from '../../hooks/useBattle'
import { Sprite } from '../common/Sprite'
import { speciesSprite, trainerSprite } from '../common/spriteUrls'
import { es } from '../../i18n/es'
import { DataBox } from './DataBox'
import { IntroLayer, IrisWipe } from './IntroLayer'
import { MessageBox } from './MessageBox'
import { genderOfSpecies, speciesLabel } from './battleModel'
import { uiAsset, type Avatar } from './introAssets'
import { backSpriteHeight, playerSpriteBottom } from './playerSpriteAnchor'
import { playerHandPoint, playerLandingPoint, rivalHandPoint, rivalLandingPoint } from './throwGeometry'

type TopScreenProps = {
  view: BattleView | null
  data: GameData
  challenge: Challenge
  introPhase: IntroPhase
  /** Cambio de Pokémon en curso (retirada y envío) de ese bando; `null` si no hay. */
  switchAnim: SwitchAnimation | null
  avatar: Avatar
  message: string | null
  onAdvance: () => void
}

const FALLBACK_BOX = 96

function weatherLabel(weather: string): string {
  return (es.battle.weather as Record<string, string>)[weather] ?? es.battle.weatherUnknown
}

function activeMon(side: BattleView['player']): MonView | null {
  return side.active === null ? null : side.team[side.active]
}

/** Pantalla superior (256x192): fondo del PWT, Pokémon, cajas de datos, clima y caja de mensajes. */
export function TopScreen({ view, data, challenge, introPhase, switchAnim, avatar, message, onAdvance }: TopScreenProps) {
  const rivalMon = view ? activeMon(view.rival) : null
  const playerMon = view ? activeMon(view.player) : null
  const playerSpriteId = playerMon ? data.dex.species[playerMon.species]?.spriteId ?? playerMon.species : ''
  const rivalSpriteId = rivalMon ? data.dex.species[rivalMon.species]?.spriteId ?? rivalMon.species : ''

  return (
    <section data-testid="field" className="bt-top bt-field" data-intro={introPhase} data-switch={switchAnim ?? undefined} aria-label={es.battle.fieldLabel}>
      <img className="bt-bg" src={uiAsset('bg/pwt.png')} alt="" />

      {rivalMon && (
        <div className="bt-mon bt-mon-rival" data-fainted={rivalMon.fainted}>
          <Sprite src={speciesSprite(data.dex, rivalMon.species, 'front')} name={speciesLabel(data.names, rivalMon.species)} width={FALLBACK_BOX} height={FALLBACK_BOX} className="bt-sprite" />
        </div>
      )}
      {playerMon && (
        <div className="bt-mon bt-mon-player" data-fainted={playerMon.fainted} style={{ top: playerSpriteBottom(backSpriteHeight(data.dex.species[playerMon.species]?.spriteId ?? playerMon.species)) }}>
          <Sprite src={speciesSprite(data.dex, playerMon.species, 'back')} name={speciesLabel(data.names, playerMon.species)} width={FALLBACK_BOX} height={FALLBACK_BOX} className="bt-sprite" />
        </div>
      )}

      {(introPhase !== 'done' || switchAnim !== null) && (
        <IntroLayer
          trainerName={challenge.trainer.nameEs}
          trainerSpriteUrl={trainerSprite(challenge.trainer.sprite)}
          avatar={avatar}
          player={{ hand: playerHandPoint(avatar), landing: playerLandingPoint(playerSpriteId) }}
          rival={{ hand: rivalHandPoint(challenge.trainer.sprite), landing: rivalLandingPoint(rivalSpriteId) }}
        />
      )}

      {rivalMon && <DataBox side="rival" mon={rivalMon} name={speciesLabel(data.names, rivalMon.species)} testId="rival-hp" gender={genderOfSpecies(challenge.rivalTeam, rivalMon.species)} />}
      {playerMon && <DataBox side="player" mon={playerMon} name={speciesLabel(data.names, playerMon.species)} testId="player-hp" gender={genderOfSpecies(challenge.playerTeam, playerMon.species)} />}
      {view?.weather && <p data-testid="weather" className="bt-weather">{weatherLabel(view.weather)}</p>}

      <MessageBox text={message} onAdvance={onAdvance} />
      {(introPhase === 'loading' || introPhase === 'iris') && <IrisWipe />}
    </section>
  )
}
