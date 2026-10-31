import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { battleMusicFor, CRITICAL_HEALTH_MUSIC, getAudio, LAST_POKEMON_MUSIC, SFX_IDS } from '../../audio/audio'
import { MUSIC_CHANGE_FADE_MS } from '../../audio/audioEngine'
import type { BattleClient } from '../../battle/client'
import type { AiKind, BattleRequest, EngineEnd } from '../../battle/protocol'
import { MAX_TURNS } from '../../config'
import type { Challenge, GameData } from '../../core/types'
import { HP_BAR_ANIMATION_MS, useBattle, type BattleParams } from '../../hooks/useBattle'
import type { BattleMode } from '../../storage/gameStore'
import { useReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { es } from '../../i18n/es'
import { Dialog } from '../common/Dialog'
import { Modal } from '../common/Modal'
import { SoundSettings } from '../menu/SoundSettings'
import type { AnimationMode, SoundPrefs } from '../../storage/settings'
import { HistoryDialog } from './HistoryDialog'
import { RemainingIndicator } from './RemainingIndicator'
import { TopScreen } from './TopScreen'
import { PartyScreen } from './party/PartyScreen'
import { PARTY_SCREEN_IMAGES, useImagesReady } from './preloadAssets'
import { partyMembers, requestFromView, rivalMembers } from './party/partyModel'
import { TouchScreen, type TouchMode } from './TouchScreen'
import { canChoose, hasOnlyForcedMove, isForcedSwitch, moveOptions, playerInPinch, lastPokemonThemeOn, switchBlockedReason, switchOptions } from './battleModel'
import { avatarForSeed } from './introAssets'
import { menuSoundFor } from './menuSounds'
import { SCREEN_HEIGHT, SCREEN_WIDTH, STAGE_HEIGHT, useStageScale } from './useStageScale'
import './battle.css'

type BattleScreenProps = {
  client: BattleClient
  data: GameData
  challenge: Challenge
  playerLead: number
  battleSeed: string
  ai?: AiKind
  /**
   * Etiqueta OFICIAL/PRÁCTICA y textos de salir y rendirse (PRD §10.2). Por defecto, práctica. `replay` (F5, RF-127): repetición, sin menú
   * de combate; en su lugar van `controls` y «Volver» sale sin confirmar. `controls` recibe `openTeam`, que abre la pantalla de equipo de
   * un bando en solo lectura, con Datos (decisión de Jose, 29/10/2026).
   */
  mode?: BattleMode | 'replay'
  controls?: (openTeam: (side: ReplayTeam) => void) => ReactNode
  /** Reanudación de un oficial guardado: sin intro y con las decisiones ya tomadas reproducidas. */
  replay?: BattleParams['replay']
  onDecision?: BattleParams['onDecision']
  onSettled?: BattleParams['onSettled']
  onReplayFailed?: BattleParams['onReplayFailed']
  paused?: BattleParams['paused']
  /** Velocidad de Ajustes; al cambiarla con el botón del combate se avisa para guardarla. */
  initialSpeed?: BattleParams['initialSpeed']
  onSpeedChange?: BattleParams['onSpeedChange']
    /** Animaciones del combate (Ajustes): por defecto «Siempre», aunque el sistema pida reducir movimiento. */
  animations?: AnimationMode
  /** Sonido y volumen de Ajustes; con `onSoundChange`, el botón Sonido los cambia desde el combate (decisión de Jose, DEC-57). */
  sound?: SoundPrefs
  onSoundChange?: (sound: SoundPrefs) => void
  onFinish: (ended: EngineEnd) => void
  onExit: () => void
}

/** Bando cuyo equipo se consulta en el visor de repeticiones. */
export type ReplayTeam = 'player' | 'rival'

type PendingDialog = 'forfeit' | 'exit' | 'history' | 'sound' | null

/** Menú elegido para una petición concreta: cuando llega otra petición (turno nuevo) se vuelve al menú principal. */
type TouchChoice = { request: BattleRequest | null; mode: TouchMode }

const isInteractive = (target: EventTarget | null): boolean => target instanceof HTMLElement && target.closest('button, a, input, select, textarea, [role="dialog"]') !== null

export function BattleScreen({ client, data, challenge, playerLead, battleSeed, ai = 'heuristic', mode = 'practice', controls, replay, onDecision, onSettled, onReplayFailed, paused, initialSpeed, onSpeedChange, animations = 'always', sound, onSoundChange, onFinish, onExit }: BattleScreenProps) {
  const { trainer, rivalTeam, playerTeam } = challenge
  const speciesName = (speciesId: string, fallback: string): string => data.names.species[speciesId] ?? fallback
  // Grito de una especie: va por su `spriteId` (las formas tienen el suyo o el de la especie base; `gen:cries`).
  const cryIdOf = useCallback((speciesId: string): string => data.dex.species[speciesId]?.spriteId ?? speciesId, [data])

  const battle = useBattle({
    client,
    init: { battleSeed, player: playerTeam, playerLead, rival: rivalTeam, ai, maxTurns: MAX_TURNS },
    translateContext: { names: data.names, trainer: { nameEs: trainer.nameEs, category: trainer.category, gender: trainer.gender } },
    intro: {
      rivalLead: speciesName(rivalTeam[0].species, rivalTeam[0].nameEs),
      playerLead: speciesName(playerTeam[playerLead].species, playerTeam[playerLead].nameEs),
    },
    onFinish,
    replay,
    onDecision,
    onSettled,
    onReplayFailed,
    paused,
    initialSpeed,
    onSpeedChange,
    playCry: (species, faint) => getAudio().playCry(cryIdOf(species), { faint }),
  })

  const reducedMotion = useReducedMotion(animations)
  const layoutRef = useRef(null as HTMLDivElement | null)
  const { scale, wide, frame } = useStageScale(layoutRef)
  const avatar = useMemo(() => avatarForSeed(battleSeed), [battleSeed])
  const [touchChoice, setTouchChoice] = useState({ request: null, mode: 'main' } as TouchChoice)
  const [dialog, setDialog] = useState(null as PendingDialog)
  // Petición de cambio forzado ya contestada: la pantalla de equipo se cierra al elegir para que se vea el lanzamiento de la Poké Ball del nuevo Pokémon.
  const [answeredForcedRequest, setAnsweredForcedRequest] = useState(null as BattleRequest | null)
  // Equipo rival abierto desde el cambio forzado (botón RIVAL de la pantalla de equipo): al volver, se sigue eligiendo sustituto.
  const [rivalPeek, setRivalPeek] = useState(null as BattleRequest | null)
  // Visor (F5): equipo abierto con los botones de la barra; se cierra con Volver de la pantalla de equipo.
  const [replayTeam, setReplayTeam] = useState(null as ReplayTeam | null)

  const { request, lastChoiceRequest, choose, advance } = battle
  const menuRequest = request ?? lastChoiceRequest
  const canActNow = battle.canAct && canChoose(request)
  const forcedSwitch = isForcedSwitch(menuRequest)
  const forcedSwitchPending = forcedSwitch && answeredForcedRequest !== menuRequest
  const moves = moveOptions(menuRequest, data)
  const blockedReason = menuRequest === null ? null : switchBlockedReason(menuRequest, switchOptions(menuRequest, data.names))
  // En el visor no hay petición del simulador: las placas salen de la vista grabada.
  const partyRequest = mode === 'replay' ? requestFromView(battle.view, playerTeam) : menuRequest
  const members = useMemo(() => partyMembers(partyRequest, battle.view, data, playerTeam), [partyRequest, battle.view, data, playerTeam])
  const rivals = useMemo(() => rivalMembers(battle.view, data, rivalTeam), [battle.view, data, rivalTeam])
  const touchMode: TouchMode = forcedSwitchPending ? (rivalPeek === menuRequest ? 'rival' : 'switch') : touchChoice.request === menuRequest ? touchChoice.mode : 'main'
  const ended = battle.ended !== null

  // Música del rival (DEC-57): se descargan su pista y los efectos al entrar; suena desde el iris de la intro (o desde el principio al
  // reanudar un oficial, que no tiene intro) y se funde al terminar el combate, al salir o al desmontar. La velocidad no la cambia.
  // En el visor (RF-128) la pantalla se vuelve a montar en cada salto: la música sigue sin cortarse y la para el visor al salir.
  // Con el último Pokémon del rival en el campo, su tema en vez del del rival, con transición (decisión de Jose, 30/10/2026); sigue
  // sonando cuando ese último cae.
  const rivalMusic = battleMusicFor(trainer)
  const music = lastPokemonThemeOn(battle.view) ? LAST_POKEMON_MUSIC : rivalMusic
  // Gritos (Jose, 31/10/2026): solo los de los Pokémon de este combate, como la música.
  const cries = useMemo(() => [...playerTeam, ...rivalTeam].map((set) => cryIdOf(set.species)), [playerTeam, rivalTeam, cryIdOf])
  useEffect(() => getAudio().preload([rivalMusic, LAST_POKEMON_MUSIC, CRITICAL_HEALTH_MUSIC], SFX_IDS, cries), [rivalMusic, cries])
  const musicOn = battle.introPhase !== 'loading' && (mode === 'replay' || !ended)
  // Parar va aparte de cambiar de tema: al pasar al del último Pokémon no se para la música (ni se pierde la de vida baja).
  useEffect(() => {
    if (!musicOn || mode === 'replay') return
    const audio = getAudio()
    return () => audio.stopMusic()
  }, [musicOn, mode])
  const playedMusic = useRef(null as string | null)
  useEffect(() => {
    if (!musicOn) return
    const change = playedMusic.current !== null && playedMusic.current !== music
    getAudio().playMusic(music, change ? { crossfadeMs: MUSIC_CHANGE_FADE_MS } : undefined)
    playedMusic.current = music
  }, [musicOn, music])

  // Música de vida baja (decisión de Jose, 30/10/2026; antes, un pitido): mientras el Pokémon del jugador tiene la barra en rojo, desde
  // que la barra termina de bajar, corta la del rival y suena ella desde el principio, en bucle. Al curarse, al cambiarlo, al debilitarse
  // (PS a 0), al terminar el combate o al salir, vuelve la del rival por donde iba; si vuelve a estar en rojo, empieza otra vez.
  const pinch = musicOn && playerInPinch(battle.view)
  const barMs = HP_BAR_ANIMATION_MS / battle.speed
  useEffect(() => {
    if (!pinch) return
    const audio = getAudio()
    const timer = setTimeout(() => audio.setPinchMusic(CRITICAL_HEALTH_MUSIC), barMs)
    return () => {
      clearTimeout(timer)
      audio.setPinchMusic(null)
    }
  }, [pinch, barMs])

  const autoChosenFor = useRef(request)
  useEffect(() => {
    if (!canActNow || !hasOnlyForcedMove(request) || autoChosenFor.current === request) return
    autoChosenFor.current = request
    choose({ type: 'move', slot: 1 })
  }, [canActNow, request, choose])

  useEffect(() => {
    if (dialog !== null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'Enter' && event.key !== ' ') || isInteractive(event.target)) return
      event.preventDefault()
      advance()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, advance])

  const activePlayerName = battle.view?.player.active == null ? null : speciesName(battle.view.player.team[battle.view.player.active].species, '')
  const prompt = canActNow && !forcedSwitch && battle.introPhase === 'done' && activePlayerName ? es.battle.whatWillDo(activePlayerName) : null
  const message = prompt ?? battle.message

  function chooseMove(slot: number) {
    choose({ type: 'move', slot })
  }

  function chooseSwitch(slot: number) {
    if (forcedSwitch) setAnsweredForcedRequest(menuRequest)
    setTouchChoice({ request: menuRequest, mode: 'main' })
    choose({ type: 'switch', slot })
  }

  const partyReady = useImagesReady(PARTY_SCREEN_IMAGES, touchMode === 'switch' || touchMode === 'rival' || replayTeam !== null)
  const partyOpen = touchMode === 'switch' && partyReady && !battle.failed && members.length > 0
  const rivalOpen = touchMode === 'rival' && partyReady && !battle.failed && rivals.length > 0
  const closeToMain = () => setTouchChoice({ request: menuRequest, mode: 'main' })
  const replayPartyOpen = replayTeam === 'player' && partyReady && !battle.failed && members.length > 0
  const replayRivalOpen = replayTeam === 'rival' && partyReady && !battle.failed && rivals.length > 0

  function confirmDialog() {
    const confirmed = dialog
    setDialog(null)
    if (confirmed === 'forfeit') battle.forfeit()
    if (confirmed === 'exit') onExit()
  }

  const rootStyle = { '--speed': battle.speed, '--k': scale } as CSSProperties
  const stageStyle = { width: SCREEN_WIDTH * scale, height: STAGE_HEIGHT * scale } as CSSProperties

  return (
    <div data-testid="battle-screen" data-reduced-motion={reducedMotion ? 'true' : undefined} className="bt-root" style={rootStyle}>
      <main className="bt" inert={dialog !== null} aria-hidden={dialog !== null ? true : undefined}>
        <h1 className="sr-only">{es.battle.heading}</h1>
        <div ref={layoutRef} className="bt-layout" data-layout={wide ? 'wide' : 'stacked'}>
          <div className="bt-chrome">
            <div className="bt-chrome-buttons">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => (mode === 'replay' ? onExit() : setDialog('exit'))}>{mode === 'replay' ? es.battle.back : es.battle.exit}</button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setDialog('history')}>{es.battle.history}</button>
              <button type="button" className="btn btn-secondary btn-small" onClick={battle.cycleSpeed}>{es.battle.speed(battle.speed)}</button>
              {sound && onSoundChange && (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setDialog('sound')}>{es.battle.sound}</button>
              )}
            </div>
            {battle.view && (
              <div className="bt-counters">
                <RemainingIndicator side={battle.view.player} label={es.battle.you} testId="remaining-player" />
                <RemainingIndicator side={battle.view.rival} label={es.battle.rival} testId="remaining-rival" />
              </div>
            )}
          </div>

          {/* Marco de consola (DS sencilla) en escritorio, solo si cabe sin bajar la escala: carcasa, bisel y bisagra a los lados. */}
          <div className="bt-console" data-frame={frame || undefined}>
          <div className="bt-stage" style={stageStyle}>
            <div
              className="bt-ds"
              style={{ width: SCREEN_WIDTH, height: STAGE_HEIGHT }}
              onClickCapture={(event) => {
                const sound = menuSoundFor(event.target)
                if (sound) getAudio().playSfx(sound)
              }}
            >
              <span data-testid="battle-mode" data-mode={mode} className={`bt-mode bt-mode-${mode}`} role="img" aria-label={mode === 'replay' ? es.battle.modeReplayLabel : es.battle.modeLabel(mode === 'official')}>
                {mode === 'replay' ? es.battle.modeReplay : mode === 'official' ? es.battle.modeOfficial : es.battle.modePractice}
              </span>
              {partyOpen && (
                <PartyScreen
                  members={members}
                  data={data}
                  forced={forcedSwitch}
                  enabled={canActNow}
                  onChoose={chooseSwitch}
                  onClose={closeToMain}
                  onRival={forcedSwitchPending ? () => setRivalPeek(menuRequest) : undefined}
                />
              )}
              {rivalOpen && (
                <PartyScreen
                  members={rivals}
                  data={data}
                  forced={false}
                  enabled
                  onChoose={() => {}}
                  onClose={forcedSwitchPending ? () => setRivalPeek(null) : closeToMain}
                  readOnly={{ prompt: es.battle.party.rivalPrompt(trainer.nameEs), label: es.battle.party.rivalLabel }}
                />
              )}
              {(replayPartyOpen || replayRivalOpen) && (
                <PartyScreen
                  members={replayPartyOpen ? members : rivals}
                  data={data}
                  forced={false}
                  enabled
                  onChoose={() => {}}
                  onClose={() => setReplayTeam(null)}
                  readOnly={replayPartyOpen ? { prompt: es.battle.party.playerPrompt, label: es.battle.party.label } : { prompt: es.battle.party.rivalPrompt(trainer.nameEs), label: es.battle.party.rivalLabel }}
                />
              )}
              <div className="bt-underlay" inert={partyOpen || rivalOpen || replayPartyOpen || replayRivalOpen}>
                <TopScreen view={battle.view} data={data} challenge={challenge} introPhase={battle.introPhase} switchAnim={battle.switchAnim} avatar={avatar} message={message} onAdvance={advance} speed={battle.speed} reducedMotion={reducedMotion} moveFx={reducedMotion ? null : battle.moveFx} />
                {battle.failed ? (
                  <section role="alert" className="bt-touch bt-error" style={{ height: SCREEN_HEIGHT }}>
                    <p>{es.battle.failure}</p>
                    <button type="button" className="btn btn-primary" onClick={onExit}>{es.battle.backToToday}</button>
                  </section>
                ) : (
                  <>
                  {mode === 'replay' && (
                    <section className="bt-touch bt-replay" style={{ height: SCREEN_HEIGHT }} aria-label={es.battle.modeReplayLabel}>
                      {controls?.(setReplayTeam)}
                    </section>
                  )}
                  {mode !== 'replay' && (
                  <TouchScreen
                    mode={touchMode}
                    // En un cambio forzado solo se elige sustituto: mientras la pantalla de equipo carga sus imágenes, Luchar y el resto no
                    // deben poder pulsarse por debajo (un movimiento ahí no es una decisión válida).
                    canAct={canActNow && !forcedSwitchPending}
                    forfeitEnabled={!ended}
                    moves={moves}
                    switchBlockedReason={blockedReason}
                    onMode={(mode) => setTouchChoice({ request: menuRequest, mode })}
                    onChooseMove={chooseMove}
                    onForfeit={() => setDialog('forfeit')}
                    onRival={() => setTouchChoice({ request: menuRequest, mode: 'rival' })}
                    weather={battle.view?.weather ?? null}
                    weatherTurns={battle.view?.weatherTurns ?? null}
                  />
                  )}
                  </>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </main>

      {dialog === 'history' && <HistoryDialog lines={battle.log} onClose={() => setDialog(null)} />}
      {dialog === 'sound' && sound && onSoundChange && (
        <Modal title={es.settings.soundTitle} onClose={() => setDialog(null)} className="settings-dialog">
          <SoundSettings settings={sound} onChange={onSoundChange} showTitle={false} />
        </Modal>
      )}
      {dialog === 'forfeit' && (
        <Dialog
          title={es.battle.forfeitTitle}
          body={mode === 'official' ? es.battle.forfeitBodyOfficial : es.battle.forfeitBody}
          confirmLabel={es.battle.forfeitConfirm}
          cancelLabel={es.battle.cancel}
          onConfirm={confirmDialog}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'exit' && (
        <Dialog
          title={es.battle.exitTitle}
          body={mode === 'official' ? es.battle.exitBodyOfficial : es.battle.exitBody}
          confirmLabel={es.battle.exitConfirm}
          cancelLabel={es.battle.cancel}
          onConfirm={confirmDialog}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}
