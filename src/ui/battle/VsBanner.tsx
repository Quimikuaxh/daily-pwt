/**
 * Pancarta VS del PWT (RF-137), recreada a partir del vídeo de N2/B2 (no hay gráficos del juego). Empieza con el escenario: el estadio con
 * la pantalla gigante, que enseña a los dos entrenadores del combate y sus nombres, los focos parpadeando, los flashes de las cámaras y los
 * dos entrenadores de pie de lado, mirándose (sprites de mapa, `gen:trainer-side`). A los STAGE_MS entra la pancarta: franjas roja y azul
 * que chocan (destello y bolas de fuego), medio cuerpo de los dos entrenadores (retratos `-vs.png`, `gen:trainer-vs`) en silueta que se
 * iluminan con un fogonazo que descubre la rejilla con el escudo del estadio (vs-emblem.png, calcado del vídeo), el logo «VS.» en pixel
 * art con chispas y un zoom final al logo que funde a negro. Toda la secuencia es CSS (battle.css, «Pancarta VS») y dura
 * INTRO_DURATIONS_MS.vs dividido por la velocidad. Con animaciones desactivadas se ve la pancarta compuesta, sin escenario.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { es } from '../../i18n/es'
import { PWT_STAGE, VS_EMBLEM, VS_LOGO } from './introAssets'

type VsBannerProps = {
  playerName: string
  playerSprite: string
  playerSide: string
  rivalName: string
  rivalSprite: string
  rivalSide: string
  speed?: number
  reducedMotion?: boolean
}

/** Duración del escenario antes de que entre la franja, a x1. */
export const STAGE_MS = 1500

const SPARKS = [10, 50, 95, 140, 185, 230, 275, 320] as const
/** Bolas de fuego del choque: ángulo y distancia. */
const FIREBALLS = [[200, 80], [235, 55], [160, 65], [20, 75], [330, 60], [60, 50], [300, 85], [120, 45]] as const
/** Tamaño entero del nombre en las placas de la pantalla gigante: 12 px hasta 9 letras, 10 hasta 11 y 8 a partir de ahí (caben 59 px). */
export const plateFontSize = (name: string): string => `${name.length <= 9 ? 12 : name.length <= 11 ? 10 : 8}px`

/**
 * Escenario como en N2/B2 (captura del juego limpiada, pwt-stage.png): en la pantalla gigante, el jugador a la izquierda (placa de arriba y
 * retrato en el lado rojo) y el rival a la derecha (retrato en el lado azul y placa de abajo), como en la pancarta (Jose, 11/11/2026);
 * sobre el escenario, cada uno en su lado, de pie de lado y mirándose, con su sombra.
 */
function Stage({ playerName, playerSprite, playerSide, rivalName, rivalSprite, rivalSide }: Omit<VsBannerProps, 'speed' | 'reducedMotion'>) {
  return (
    <div className="bt-vs-stage" aria-hidden="true">
      <img className="bt-vs-stage-bg" src={PWT_STAGE} alt="" />
      <div className="bt-vs-stage-portrait bt-vs-stage-portrait-left"><img src={playerSprite} alt="" /></div>
      <div className="bt-vs-stage-portrait bt-vs-stage-portrait-right"><img src={rivalSprite} alt="" /></div>
      <span className="bt-vs-stage-plate bt-vs-stage-plate-top" style={{ '--size': plateFontSize(playerName) } as CSSProperties}>{playerName}</span>
      <span className="bt-vs-stage-plate bt-vs-stage-plate-bottom" style={{ '--size': plateFontSize(rivalName) } as CSSProperties}>{rivalName}</span>
      <i className="bt-vs-stage-shadow bt-vs-stage-shadow-left" />
      <i className="bt-vs-stage-shadow bt-vs-stage-shadow-right" />
      <img className="bt-vs-stage-trainer bt-vs-stage-trainer-left" src={playerSide} alt="" />
      <img className="bt-vs-stage-trainer bt-vs-stage-trainer-right" src={rivalSide} alt="" />
      <div className="bt-vs-stage-flash" />
    </div>
  )
}

export function VsBanner({ playerName, playerSprite, playerSide, rivalName, rivalSprite, rivalSide, speed = 1, reducedMotion = false }: VsBannerProps) {
  // La pancarta se monta al acabar el escenario, así sus animaciones CSS empiezan entonces.
  const [stage, setStage] = useState(!reducedMotion)
  useEffect(() => {
    if (!stage) return
    const timer = setTimeout(() => setStage(false), STAGE_MS / speed)
    return () => clearTimeout(timer)
  }, [stage, speed])

  return (
    <div className="bt-vs" role="img" aria-label={es.battle.vsLabel(playerName, rivalName)}>
      {stage ? (
        <Stage playerName={playerName} playerSprite={playerSprite} playerSide={playerSide} rivalName={rivalName} rivalSprite={rivalSprite} rivalSide={rivalSide} />
      ) : (
        <>
          <div className="bt-vs-backdrop">
            <Stage playerName={playerName} playerSprite={playerSprite} playerSide={playerSide} rivalName={rivalName} rivalSprite={rivalSprite} rivalSide={rivalSide} />
          </div>
          <div className="bt-vs-fence"><img className="bt-vs-emblem" src={VS_EMBLEM} alt="" /></div>
          {/* El jugador a la izquierda (franja roja) y el rival a la derecha (azul), mirando los dos hacia el centro (Jose, 11/11/2026). */}
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
        </>
      )}
    </div>
  )
}
