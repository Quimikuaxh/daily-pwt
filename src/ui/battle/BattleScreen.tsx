import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { battleMusicFor, getAudio, SFX_IDS } from '../../audio/audio'
import type { BattleClient } from '../../battle/client'
import type { AiKind, BattleRequest, EngineEnd } from '../../battle/protocol'
import { MAX_TURNS } from '../../config'
import type { Challenge, GameData } from '../../core/types'
import { useBattle, type BattleParams } from '../../hooks/useBattle'
import type { BattleMode } from '../../storage/gameStore'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { es } from '../../i18n/es'
import { Dialog } from '../common/Dialog'
import { Modal } from '../common/Modal'
import { SoundSettings } from '../menu/SoundSettings'
import type { SoundPrefs } from '../../storage/settings'
import { HistoryDialog } from './HistoryDialog'
import { RemainingIndicator } from './RemainingIndicator'
import { TopScreen } from './TopScreen'
import { PartyScreen } from './party/PartyScreen'
import { PARTY_SCREEN_IMAGES, useImagesReady } from './preloadAssets'
import { partyMembers, rivalMembers } from './party/partyModel'
import { TouchScreen, type TouchMode } from './TouchScreen'
import { canChoose, hasOnlyForcedMove, isForcedSwitch, moveOptions, switchBlockedReason, switchOptions } from './battleModel'
import { avatarForSeed } from './introAssets'
import { SCREEN_HEIGHT, SCREEN_WIDTH, STAGE_HEIGHT, useStageScale } from './useStageScale'
import './battle.css'

type BattleScreenProps = {
  client: BattleClient
  data: GameData
  challenge: Challenge
  playerLead: number
  battleSeed: string
  ai?: AiKind
  /** Etiqueta OFICIAL/PRÁCTICA y textos de salir y rendirse (PRD §10.2). Por defecto, práctica. */
  mode?: BattleMode
  /** Reanudación de un oficial guardado: sin intro y con las decisiones ya tomadas reproducidas. */
  replay?: BattleParams['replay']
  onDecision?: BattleParams['onDecision']
  onSettled?: BattleParams['onSettled']
  onReplayFailed?: BattleParams['onReplayFailed']
  /** Velocidad de Ajustes; al cambiarla con el botón del combate se avisa para guardarla. */
  initialSpeed?: BattleParams['initialSpeed']
  onSpeedChange?: BattleParams['onSpeedChange']
  /** Animaciones de movimientos (Ajustes, por defecto activadas). */
  moveAnimations?: boolean
  /** Sonido y volumen de Ajustes; con `onSoundChange`, el botón Sonido los cambia desde el combate (decisión de Jose, DEC-57). */
  sound?: SoundPrefs
  onSoundChange?: (sound: SoundPrefs) => void
  onFinish: (ended: EngineEnd) => void
  onExit: () => void
}

type PendingDialog = 'forfeit' | 'exit' | 'history' | 'sound' | null

/** Menú elegido para una petición concreta: cuando llega otra petición (turno nuevo) se vuelve al menú principal. */
type TouchChoice = { request: BattleRequest | null; mode: TouchMode }

const isInteractive = (target: EventTarget | null): boolean => target instanceof HTMLElement && target.closest('button, a, input, select, textarea, [role="dialog"]') !== null

export function BattleScreen({ client, data, challenge, playerLead, battleSeed, ai = 'heuristic', mode = 'practice', replay, onDecision, onSettled, onReplayFailed, initialSpeed, onSpeedChange, moveAnimations = true, sound, onSoundChange, onFinish, onExit }: BattleScreenProps) {
  const { trainer, rivalTeam, playerTeam } = challenge
  const speciesName = (speciesId: string, fallback: string): string => data.names.species[speciesId] ?? fallback

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
    initialSpeed,
    onSpeedChange,
  })

  const reducedMotion = usePrefersReducedMotion()
  const layoutRef = useRef(null as HTMLDivElement | null)
  const { scale, wide, frame } = useStageScale(layoutRef)
  const avatar = useMemo(() => avatarForSeed(battleSeed), [battleSeed])
  const [touchChoice, setTouchChoice] = useState({ request: null, mode: 'main' } as TouchChoice)
  const [dialog, setDialog] = useState(null as PendingDialog)
  // Petición de cambio forzado ya contestada: la pantalla de equipo se cierra al elegir para que se vea el lanzamiento de la Poké Ball del nuevo Pokémon.
  const [answeredForcedRequest, setAnsweredForcedRequest] = useState(null as BattleRequest | null)

  const { request, lastChoiceRequest, choose, advance } = battle
  const menuRequest = request ?? lastChoiceRequest
  const canActNow = battle.canAct && canChoose(request)
  const forcedSwitch = isForcedSwitch(menuRequest)
  const forcedSwitchPending = forcedSwitch && answeredForcedRequest !== menuRequest
  const moves = moveOptions(menuRequest, data)
  const blockedReason = menuRequest === null ? null : switchBlockedReason(menuRequest, switchOptions(menuRequest, data.names))
  const members = useMemo(() => partyMembers(menuRequest, battle.view, data, playerTeam), [menuRequest, battle.view, data, playerTeam])
  const rivals = useMemo(() => rivalMembers(battle.view, data, rivalTeam), [battle.view, data, rivalTeam])
  const touchMode: TouchMode = forcedSwitchPending ? 'switch' : touchChoice.request === menuRequest ? touchChoice.mode : 'main'
  const ended = battle.ended !== null

  // Música del rival (DEC-57): se descargan su pista y los efectos al entrar; suena desde el iris de la intro (o desde el principio al
  // reanudar un oficial, que no tiene intro) y se funde al terminar el combate, al salir o al desmontar. La velocidad no la cambia.
  const music = battleMusicFor(trainer)
  useEffect(() => getAudio().preload([music], SFX_IDS), [music])
  const musicOn = battle.introPhase !== 'loading' && !ended
  useEffect(() => {
    if (!musicOn) return
    const audio = getAudio()
    audio.playMusic(music)
    return () => audio.stopMusic()
  }, [musicOn, music])

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

  const partyReady = useImagesReady(PARTY_SCREEN_IMAGES, touchMode === 'switch' || touchMode === 'rival')
  const partyOpen = touchMode === 'switch' && partyReady && !battle.failed && members.length > 0
  const rivalOpen = touchMode === 'rival' && partyReady && !battle.failed && rivals.length > 0
  const closeToMain = () => setTouchChoice({ request: menuRequest, mode: 'main' })

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
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setDialog('exit')}>{es.battle.exit}</button>
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
            <div className="bt-ds" style={{ width: SCREEN_WIDTH, height: STAGE_HEIGHT }}>
              <span data-testid="battle-mode" data-mode={mode} className={`bt-mode bt-mode-${mode}`} role="img" aria-label={es.battle.modeLabel(mode === 'official')}>
                {mode === 'official' ? es.battle.modeOfficial : es.battle.modePractice}
              </span>
              {partyOpen && (
                <PartyScreen
                  members={members}
                  data={data}
                  forced={forcedSwitch}
                  enabled={canActNow}
                  onChoose={chooseSwitch}
                  onClose={closeToMain}
                />
              )}
              {rivalOpen && (
                <PartyScreen
                  members={rivals}
                  data={data}
                  forced={false}
                  enabled
                  onChoose={() => {}}
                  onClose={closeToMain}
                  readOnly={{ prompt: es.battle.party.rivalPrompt(trainer.nameEs), label: es.battle.party.rivalLabel }}
                />
              )}
              <div className="bt-underlay" inert={partyOpen || rivalOpen}>
                <TopScreen view={battle.view} data={data} challenge={challenge} introPhase={battle.introPhase} switchAnim={battle.switchAnim} avatar={avatar} message={message} onAdvance={advance} speed={battle.speed} reducedMotion={reducedMotion} moveFx={moveAnimations && !reducedMotion ? battle.moveFx : null} />
                {battle.failed ? (
                  <section role="alert" className="bt-touch bt-error" style={{ height: SCREEN_HEIGHT }}>
                    <p>{es.battle.failure}</p>
                    <button type="button" className="btn btn-primary" onClick={onExit}>{es.battle.backToToday}</button>
                  </section>
                ) : (
                  <TouchScreen
                    mode={touchMode}
                    canAct={canActNow}
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
