import { Suspense, lazy, useRef, useState, type CSSProperties } from 'react'
import type { BattleView, MonView } from '../../battle/protocol'
import type { Challenge, GameData } from '../../core/types'
import type { IntroPhase, SwitchAnimation } from '../../hooks/useBattle'
import { Sprite } from '../common/Sprite'
import { speciesSprite, substituteSprite, trainerSprite } from '../common/spriteUrls'
import { es } from '../../i18n/es'
import { DataBox } from './DataBox'
import { IntroLayer, IrisWipe } from './IntroLayer'
import { MessageBox } from './MessageBox'
import { resolveHiddenPowerId } from '../../core/hiddenPower'
import type { MoveFxEvent } from './fx/MoveFx'
import { genderOfSpecies, speciesLabel } from './battleModel'
import { uiAsset, type Avatar } from './introAssets'
import { backSpriteHeight, PLAYER_SPRITE_SCALE, playerSpriteBottom, playerSpriteScale } from './playerSpriteAnchor'
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

function playerSpriteStyle(spriteId: string): CSSProperties {
  const spriteHeight = backSpriteHeight(spriteId)
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

/** Pantalla superior (256x192): fondo del PWT, Pokémon, cajas de datos, clima y caja de mensajes. */
export function TopScreen({ view, data, challenge, introPhase, switchAnim, avatar, message, onAdvance, speed, reducedMotion, moveFx = null }: TopScreenProps) {
  const fieldRef = useRef(null as HTMLElement | null)
  const rivalMon = view ? activeMon(view.rival) : null
  const playerMon = view ? activeMon(view.player) : null
  const playerSpriteId = playerMon ? data.dex.species[playerMon.species]?.spriteId ?? playerMon.species : ''
  const rivalSpriteId = rivalMon ? data.dex.species[rivalMon.species]?.spriteId ?? rivalMon.species : ''

  return (
    <section ref={fieldRef} data-testid="field" className="bt-top bt-field" data-intro={introPhase} data-switch={switchAnim ?? undefined} aria-label={es.battle.fieldLabel}>
      <img className="bt-bg" src={uiAsset('bg/pwt.png')} alt="" />

      {rivalMon && (
        <div className="bt-mon bt-mon-rival" data-fainted={rivalMon.fainted}>
          <MonSprite mon={rivalMon} side="front" data={data} />
        </div>
      )}
      {playerMon && (
        <div className="bt-mon bt-mon-player" data-fainted={playerMon.fainted} data-oversize={playerSpriteScale(backSpriteHeight(playerSpriteId)) < PLAYER_SPRITE_SCALE || undefined} style={playerSpriteStyle(playerSpriteId)}>
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

      {rivalMon && <DataBox side="rival" mon={rivalMon} name={speciesLabel(data.names, rivalMon.species)} testId="rival-hp" gender={genderOfSpecies(challenge.rivalTeam, rivalMon.species)} speed={speed} reducedMotion={reducedMotion} />}
      {playerMon && <DataBox side="player" mon={playerMon} name={speciesLabel(data.names, playerMon.species)} testId="player-hp" gender={genderOfSpecies(challenge.playerTeam, playerMon.species)} speed={speed} reducedMotion={reducedMotion} />}

      <Suspense fallback={null}>
        <MoveFx
          event={moveFx}
          type={moveFx ? moveFxType(moveFx, moveFx.user === 'player' ? playerMon : rivalMon, moveFx.user === 'player' ? challenge.playerTeam : challenge.rivalTeam, data) : null}
          points={{ player: playerLandingPoint(playerSpriteId), rival: rivalLandingPoint(rivalSpriteId) }}
          speed={speed ?? 1}
          fieldRef={fieldRef}
        />
      </Suspense>
      <MessageBox text={message} onAdvance={onAdvance} />
      {(introPhase === 'loading' || introPhase === 'iris') && <IrisWipe />}
    </section>
  )
}
