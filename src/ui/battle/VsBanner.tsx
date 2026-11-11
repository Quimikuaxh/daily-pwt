/**
 * Pancarta VS del PWT (RF-137), recreada a partir del vídeo de N2/B2 (no hay gráficos del juego): franjas roja y azul que
 * entran desde los lados sobre el estadio y chocan (destello y bolas de fuego), medio cuerpo de arriba de los dos entrenadores (retratos `-vs.png`: último fotograma
 * recortado por arriba, `gen:trainer-vs`), en silueta negra, que se iluminan con un destello, el
 * logo «VS.» en pixel art (vs-logo.png) con chispas y un zoom final al logo que funde a negro. Toda la secuencia es CSS (battle.css, «Pancarta VS»)
 * y dura INTRO_DURATIONS_MS.vs dividido por la velocidad.
 */
import type { CSSProperties } from 'react'
import { es } from '../../i18n/es'
import { VS_LOGO } from './introAssets'

type VsBannerProps = { playerName: string; playerSprite: string; rivalName: string; rivalSprite: string }

const SPARKS = [10, 50, 95, 140, 185, 230, 275, 320] as const
/** Bolas de fuego del choque: ángulo y distancia. */
const FIREBALLS = [[200, 80], [235, 55], [160, 65], [20, 75], [330, 60], [60, 50], [300, 85], [120, 45]] as const

export function VsBanner({ playerName, playerSprite, rivalName, rivalSprite }: VsBannerProps) {
  return (
    <div className="bt-vs" role="img" aria-label={es.battle.vsLabel(playerName, rivalName)}>
      <div className="bt-vs-fence" />
      <div className="bt-vs-band bt-vs-band-player">
        <img className="bt-vs-trainer" src={playerSprite} alt="" />
      </div>
      <div className="bt-vs-band bt-vs-band-rival">
        <img className="bt-vs-trainer" src={rivalSprite} alt="" />
      </div>
      <div className="bt-vs-clash">
        {FIREBALLS.map(([angle, dist]) => <i key={angle} style={{ '--a': `${angle}deg`, '--d': `${dist}px` } as CSSProperties} />)}
      </div>
      <span className="bt-vs-name bt-vs-name-player">{playerName}</span>
      <span className="bt-vs-name bt-vs-name-rival">{rivalName}</span>
      <div className="bt-vs-flash" />
      <img className="bt-vs-logo" src={VS_LOGO} alt="" />
      <div className="bt-vs-sparks">
        {SPARKS.map((angle) => <i key={angle} style={{ '--a': `${angle}deg` } as CSSProperties} />)}
      </div>
    </div>
  )
}
