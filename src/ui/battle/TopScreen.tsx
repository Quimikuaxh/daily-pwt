import { Suspense, lazy, useRef, useState, type CSSProperties } from 'react'
import type { BattleView, MonView } from '../../battle/protocol'
import type { Challenge, GameData } from '../../core/types'
import type { IntroPhase, SwitchAnimation } from '../../hooks/useBattle'
import { Sprite } from '../common/Sprite'
import { FieldLights } from './FieldLights'
import { VsBanner } from './VsBanner'
import { speciesSprite, substituteSprite, trainerSprite, trainerVsSprite } from '../common/spriteUrls'
import { es } from '../../i18n/es'
import { DataBox } from './DataBox'
import { IntroLayer, IrisWipe } from './IntroLayer'
import { MessageBox } from './MessageBox'
import { resolveHiddenPowerId } from '../../core/hiddenPower'
import type { MoveFxEvent } from './fx/MoveFx'
import { genderOfSpecies, speciesLabel } from './battleModel'
import { uiAsset, type Avatar } from './introAssets'
import { backSpriteHeight, PLAYER_SPRITE_SCALE, playerSpriteBottom, playerSpriteScale, substituteBackHeight } from './playerSpriteAnchor'
import { playerHandPoint, playerLandingPoint, rivalHandPoint, rivalLandingPoint } from './throwGeometry'

// Las animaciones de movimientos (DEC-53) van en su propio trozo: no pesan en la ruta crítica de Hoy (E2E-21) y se cargan durante la intro.
const MoveFx = lazy(() => import('./fx/MoveFx').then((module) => ({ default: module.MoveFx })))

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
  speed?: number
  reducedMotion?: boolean
  /** Movimiento que se anima ahora; `null` si no hay o si las animaciones están desactivadas (Ajustes o movimiento reducido). */
  moveFx?: MoveFxEvent | null
}

const FALLBACK_BOX = 96

function playerSpriteStyle(spriteHeight: number): CSSProperties {
  return { top: playerSpriteBottom(spriteHeight), '--player-scale': playerSpriteScale(spriteHeight) } as CSSProperties
}

function activeMon(side: BattleView['player']): MonView | null {
  return side.active === null ? null : side.team[side.active]
}

/** Tipo del movimiento animado; Poder Oculto, el real del Pokémon que lo usa (sale de sus IV). */
function moveFxType(event: MoveFxEvent, mon: MonView | null, team: Challenge['playerTeam'], data: GameData): string | null {
  const set = mon ? team.find((candidate) => candidate.species === mon.species) : undefined
  return data.dex.moves[resolveHiddenPowerId(event.moveId, set?.ivs)]?.type ?? null
}


/**
 * Sprite del Pokémon en el campo o, si tiene un sustituto en pie, el muñeco del sustituto (como N2/B2; decisión de Jose). Si el muñeco no
 * está descargado (`gen:sprites`), se sigue viendo el Pokémon.
 */
function MonSprite({ mon, side, data }: { mon: MonView; side: 'front' | 'back'; data: GameData }) {
  const [substituteMissing, setSubstituteMissing] = useState(false)
  if (mon.substitute && !substituteMissing) {
    return <img className="bt-sprite bt-substitute" src={substituteSprite(side)} alt={es.battle.substitute(speciesLabel(data.names, mon.species))} onError={() => setSubstituteMissing(true)} />
  }
  return <Sprite src={speciesSprite(data.dex, mon.species, side)} name={speciesLabel(data.names, mon.species)} width={FALLBACK_BOX} height={FALLBACK_BOX} className="bt-sprite" />
}

/**
 * Cámara de los ataques (como el PWT de N2/B2): si ataca el rival, se acerca a él y vuelve; si atacas tú, avanza hacia el
 * rival, que recibe el golpe. El punto fijo es el Pokémon rival; el atributo alterna con cada ataque para reiniciar la
 * animación aunque se repita el mismo lado. Los efectos de movimiento van dentro de la cámara y se acercan con ella.
 */
function moveCameraProps(event: MoveFxEvent | null, rival: { x: number; y: number }) {
  if (!event) return {}
  return {
    'data-move-camera': `${event.user}-${event.key % 2}`,
    style: { '--cam-x': `${rival.x}px`, '--cam-y': `${rival.y}px` } as CSSProperties,
  }
}

/** Destello blanco y chispas naranjas al abrirse la escena tras la cortinilla, como en la presentación del PWT. */
const SPARKS = [20, 65, 110, 155, 200, 245, 290, 335] as const
function IntroFlash() {
  return (
    <div className="bt-intro-flash" aria-hidden="true">
      {SPARKS.map((angle) => <i key={angle} style={{ '--a': `${angle}deg` } as CSSProperties} />)}
    </div>
  )
}

/**
 * Sombra del Pokémon como en N2/B2: su propia silueta, oscura y aplastada contra el suelo desde los pies. Es el mismo GIF
 * que el sprite, así que sigue su animación fotograma a fotograma, y va dentro de `.bt-mon`, así que hereda la entrada,
 * los cambios y el KO. Decorativa: sin texto alternativo. Su imagen no lleva `bt-sprite`: no es un sprite del campo (los E2E de
 * escala y posición, E2E-16/23/24, miden solo los sprites).
 */
function MonShadow({ mon, side, data }: { mon: MonView; side: 'front' | 'back'; data: GameData }) {
  const src = mon.substitute ? substituteSprite(side) : speciesSprite(data.dex, mon.species, side)
  if (!src) return null
  return (
    <span className="bt-shadow" aria-hidden="true">
      <img className="bt-shadow-img" src={src} alt="" />
    </span>
  )
}

/** Pantalla superior (256x192): fondo del PWT, Pokémon, cajas de datos, clima y caja de mensajes. */
export function TopScreen({ view, data, challenge, introPhase, switchAnim, avatar, message, onAdvance, speed, reducedMotion, moveFx = null }: TopScreenProps) {
  const fieldRef = useRef(null as HTMLElement | null)
  const rivalMon = view ? activeMon(view.rival) : null
  const playerMon = view ? activeMon(view.player) : null
  const playerSpriteId = playerMon ? data.dex.species[playerMon.species]?.spriteId ?? playerMon.species : ''
  const rivalSpriteId = rivalMon ? data.dex.species[rivalMon.species]?.spriteId ?? rivalMon.species : ''
  // Con un sustituto en pie se ve el muñeco: el jugador se apoya por su alto (DEC-61).
  const playerSpriteHeight = playerMon?.substitute ? substituteBackHeight() : backSpriteHeight(playerSpriteId)

  return (
    <section ref={fieldRef} data-testid="field" className="bt-top bt-field" data-intro={introPhase} data-switch={switchAnim ?? undefined} aria-label={es.battle.fieldLabel}>
      {/* Cámara: fondo, luces, Pokémon y entrenadores se mueven juntos durante la intro (encuadre del rival y vuelta al
          plano general); cajas de PS, mensajes y efectos de movimiento quedan fuera y no se mueven. */}
      <div className="bt-camera" {...moveCameraProps(moveFx, rivalLandingPoint(rivalSpriteId))}>
      <img className="bt-bg" src={uiAsset('bg/pwt.png')} alt="" />
      <FieldLights />

      {rivalMon && (
        <div className="bt-mon bt-mon-rival" data-fainted={rivalMon.fainted}>
          <MonShadow mon={rivalMon} side="front" data={data} />
          <MonSprite mon={rivalMon} side="front" data={data} />
        </div>
      )}
      {playerMon && (
        <div className="bt-mon bt-mon-player" data-fainted={playerMon.fainted} data-oversize={playerSpriteScale(playerSpriteHeight) < PLAYER_SPRITE_SCALE || undefined} style={playerSpriteStyle(playerSpriteHeight)}>
          <MonShadow mon={playerMon} side="back" data={data} />
          <MonSprite mon={playerMon} side="back" data={data} />
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
      <Suspense fallback={null}>
        <MoveFx
          event={moveFx}
          type={moveFx ? moveFxType(moveFx, moveFx.user === 'player' ? playerMon : rivalMon, moveFx.user === 'player' ? challenge.playerTeam : challenge.rivalTeam, data) : null}
          points={{ player: playerLandingPoint(playerSpriteId), rival: rivalLandingPoint(rivalSpriteId) }}
          speed={speed ?? 1}
          fieldRef={fieldRef}
        />
      </Suspense>
      </div>
      {introPhase === 'enter' && <IntroFlash />}

      {rivalMon && <DataBox side="rival" mon={rivalMon} name={speciesLabel(data.names, rivalMon.species)} testId="rival-hp" gender={genderOfSpecies(challenge.rivalTeam, rivalMon.species)} speed={speed} reducedMotion={reducedMotion} />}
      {playerMon && <DataBox side="player" mon={playerMon} name={speciesLabel(data.names, playerMon.species)} testId="player-hp" gender={genderOfSpecies(challenge.playerTeam, playerMon.species)} speed={speed} reducedMotion={reducedMotion} />}

      <MessageBox text={message} onAdvance={onAdvance} />
      {(introPhase === 'loading' || introPhase === 'iris') && <IrisWipe />}
      {introPhase === 'vs' && (
        <VsBanner playerName={avatar.name} playerSprite={avatar.front} rivalName={challenge.trainer.nameEs} rivalSprite={trainerVsSprite(challenge.trainer.sprite)} />
      )}
    </section>
  )
}
