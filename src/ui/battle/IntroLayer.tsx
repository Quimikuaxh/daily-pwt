import type { CSSProperties } from 'react'
import { Sprite } from '../common/Sprite'
import { uiAsset, type Avatar, type Box } from './introAssets'
import { offsetBetween, type Point } from './throwGeometry'

/** Mano del entrenador y punto donde aparece su Pokémon, para el lanzamiento de la bola y el rayo de retirada. */
export type LaunchPath = { hand: Point; landing: Point }

type IntroLayerProps = {
  trainerName: string
  trainerSpriteUrl: string
  avatar: Avatar
  player: LaunchPath
  rival: LaunchPath
}

/** Variables CSS de un lado: aterrizaje, desplazamiento de salida de la bola y rayo (largo y ángulo desde la mano hasta el Pokémon). */
function pathVariables(side: 'player' | 'rival', { hand, landing }: LaunchPath): Record<string, string> {
  const from = offsetBetween(hand, landing)
  const length = Math.hypot(from.x, from.y)
  const angle = (Math.atan2(-from.y, -from.x) * 180) / Math.PI
  return {
    [`--${side}-land-x`]: `${landing.x}px`,
    [`--${side}-land-y`]: `${landing.y}px`,
    [`--${side}-from-x`]: `${from.x}px`,
    [`--${side}-from-y`]: `${from.y}px`,
    [`--${side}-hand-x`]: `${hand.x}px`,
    [`--${side}-hand-y`]: `${hand.y}px`,
    [`--${side}-beam-length`]: `${length}px`,
    [`--${side}-beam-angle`]: `${angle}deg`,
  }
}

const poseStyle = (sheet: string, [x, y, width, height]: Box): CSSProperties => ({
  width,
  height,
  backgroundImage: `url(${sheet})`,
  backgroundPosition: `-${x}px -${y}px`,
})

/** Entrenadores, Poké Balls y rayo de la intro del combate (PRD §10.2.1) y de los cambios de Pokémon. Solo decorativa: el texto va en la caja de mensajes. */
export function IntroLayer({ trainerName, trainerSpriteUrl, avatar, player, rival }: IntroLayerProps) {
  const ballStyle: CSSProperties = { backgroundImage: `url(${uiAsset('fx/pokeball-strip.png')})` }
  const shine = uiAsset('fx/shine.png')
  return (
    <div className="bt-intro" aria-hidden="true" style={{ ...pathVariables('player', player), ...pathVariables('rival', rival) } as CSSProperties}>
      <div className="bt-trainer bt-trainer-rival">
        <Sprite src={trainerSpriteUrl} name={trainerName} width={96} height={96} className="bt-trainer-img" />
      </div>
      <div className="bt-trainer bt-trainer-player">
        <img className="bt-avatar-stand" src={avatar.stand} alt="" />
        <div className="bt-avatar-pose bt-avatar-raise" style={poseStyle(avatar.sheet, avatar.raise)} />
        <div className="bt-avatar-pose bt-avatar-throw" style={poseStyle(avatar.sheet, avatar.throw)} />
      </div>
      <span className="bt-ball bt-ball-rival" style={ballStyle} />
      <span className="bt-ball bt-ball-player" style={ballStyle} />
      <span className="bt-beam bt-beam-rival" />
      <span className="bt-beam bt-beam-player" />
      <img className="bt-shine bt-shine-rival" src={shine} alt="" />
      <img className="bt-shine bt-shine-player" src={shine} alt="" />
    </div>
  )
}

/** Cortinilla de entrada: negro mientras llega el combate y después el iris con la Poké Ball grande. */
export function IrisWipe() {
  return (
    <div className="bt-iris" aria-hidden="true">
      <img className="bt-iris-ball" src={uiAsset('transition/pokeball-wipe.png')} alt="" />
    </div>
  )
}
