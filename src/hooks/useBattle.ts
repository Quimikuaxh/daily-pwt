import { useCallback, useEffect, useRef, useState } from 'react'
import type { BattleClient, ClientMessage } from '../battle/client'
import type { BattleRequest, BattleView, Choice, EngineBattleView, EngineEnd, EngineInit } from '../battle/protocol'
import type { Checkpoint, Decision } from '../storage/gameStore'
import { introLines, translateLine, type TranslateContext } from '../battle/translate'
import { deferFaintUntilFaintLine } from '../battle/faintOrder'
import { deferHitMessages } from '../battle/messageOrder'
import { SPEEDS, type BattleSpeed } from '../storage/settings'
import { viewReducer } from '../battle/viewReducer'

export type { BattleSpeed }
/** Cada mensaje se queda en la caja de texto este tiempo (a x1) y avanza solo; un toque o tecla lo adelanta. */
const TEXT_PAUSE_MS = 1100
const VISUAL_PAUSE_MS = 400
/** Lo que tarda en bajar la barra de PS (y el número) a x1: DataBox la anima con esta duración. */
export const HP_BAR_ANIMATION_MS = 700
/** Tras cambiar los PS se espera a que la barra termine antes de nada más: el texto del golpe (supereficaz, Banda Focus…) va después, y tras un golpe letal la barra llega a 0 antes del «se ha debilitado» (DEC-42). */
const HP_BAR_PAUSE_MS = HP_BAR_ANIMATION_MS + 100
/** Con el mensaje «se ha debilitado» ya en pantalla, el sprite espera este tiempo antes de caer. */
const FAINT_MESSAGE_LEAD_MS = 400
const FINISH_PAUSE_MS = 1500

/**
 * Fases de la intro (PRD §10.2.1) y lo que dura cada una a x1. Las animaciones CSS de battle.css (`[data-intro]`) deben
 * durar lo mismo: el tiempo de cada fase lo marca este guion y el CSS solo lo dibuja. Total: 4,9 s.
 */
export type IntroPhase = 'loading' | 'iris' | 'enter' | 'challenge' | 'rivalSend' | 'playerSend' | 'done'
export const INTRO_DURATIONS_MS = { iris: 500, enter: 700, challenge: 900, rivalSend: 1300, playerSend: 1500 } as const

/**
 * Cambio de Pokémon (retirada y envío): el entrenador aparece, recoge al Pokémon con el rayo rojo (recall) y lanza la bola del nuevo (send).
 * Las animaciones de battle.css (`[data-switch]`) duran lo mismo que este guion: 1,5 s a x1 (retirada 0,5 s + envío 1 s). Si el anterior ya estaba
 * debilitado no hay retirada y el CSS arranca en el envío (`-send`).
 */
export type SwitchAnimation = 'player' | 'player-send' | 'rival' | 'rival-send'
export const SWITCH_DURATIONS_MS = { recall: 500, send: 1100 } as const

/** Líneas que mueven una barra de PS o el Pokémon activo aunque no tengan texto propio. */
const VISUAL_LINE_TYPES = new Set(['-damage', '-heal', '-sethp', 'faint', 'switch', 'drag'])
const HP_LINE_TYPES = new Set(['-damage', '-heal', '-sethp'])

type Update = Extract<ClientMessage, { type: 'update' }>

/**
 * Reanudar un combate oficial (DEC-43): se reproducen las decisiones guardadas sobre el motor, que es determinista dado `battleSeed`,
 * sin intro, sin pausas ni animaciones. `expected` es el estado esperado al terminar (null si no se pudo guardar tras la última decisión).
 */
export type ReplayPlan = { decisions: Decision[]; expected: Pick<Checkpoint, 'turn' | 'playerRemaining' | 'rivalRemaining'> | null }

export type BattleParams = {
  client: BattleClient
  init: EngineInit
  translateContext: TranslateContext
  intro: { rivalLead: string; playerLead: string }
  onFinish: (ended: EngineEnd) => void
  replay?: ReplayPlan
  /** Cada decisión del jugador que se envía al motor (no las de la reproducción). */
  onDecision?: (decision: Decision) => void
  /** Estado del combate tras presentar cada update que no es el final (no durante la reproducción). */
  onSettled?: (state: Pick<Checkpoint, 'turn' | 'playerRemaining' | 'rivalRemaining'>) => void
  /** La reproducción no llegó al estado guardado (o el motor falló): el combate no se puede reanudar. */
  onReplayFailed?: () => void
  /** Velocidad guardada en Ajustes (por defecto x1) y aviso al cambiarla desde el combate, para guardarla. */
  initialSpeed?: BattleSpeed
  onSpeedChange?: (speed: BattleSpeed) => void
}

export type BattleController = {
  view: BattleView | null
  /** Historial completo (aparte, a demanda): cada frase del combate, intro incluida, una sola vez. */
  log: string[]
  /** Mensaje que está en la caja de texto ahora (como en el juego, uno cada vez). */
  message: string | null
  introPhase: IntroPhase
  /** Retirada y envío en curso (`null` si no hay cambio animándose). */
  switchAnim: SwitchAnimation | null
  /** Un toque o tecla: adelanta el mensaje actual o, durante la intro, la salta. */
  advance: () => void
  /** Última petición vista, aunque ya no se pueda actuar: permite pintar los controles desactivados. */
  request: BattleRequest | null
  /** Última petición con movimientos o cambio forzado: el menú se sigue pintando (desactivado) mientras se anima. */
  lastChoiceRequest: BattleRequest | null
  canAct: boolean
  failed: boolean
  ended: EngineEnd | null
  speed: BattleSpeed
  cycleSpeed: () => void
  choose: (choice: Choice) => void
  forfeit: () => void
}

/** `phase` y `wait` solo los llevan los pasos de la intro: son los que "saltar" resuelve de golpe. */
type Step = { line: string | null; text: string | null; phase?: IntroPhase; wait?: number }

function introSteps(params: BattleParams): Step[] {
  const [challenge, rivalSends, playerSends] = introLines({ trainer: params.translateContext.trainer, ...params.intro })
  const D = INTRO_DURATIONS_MS
  return [
    { line: null, text: null, phase: 'iris', wait: D.iris },
    { line: null, text: null, phase: 'enter', wait: D.enter },
    { line: null, text: challenge, phase: 'challenge', wait: D.challenge },
    { line: null, text: rivalSends, phase: 'rivalSend', wait: D.rivalSend },
    { line: null, text: playerSends, phase: 'playerSend', wait: D.playerSend },
    { line: null, text: null, phase: 'done', wait: 0 },
  ]
}

function stepsFor(update: Update, isFirstUpdate: boolean, params: BattleParams): Step[] {
  // Las tres frases de apertura (RF-53) sustituyen a los `|switch|` del primer update, que repetirían lo mismo.
  const introPlan: Step[] = isFirstUpdate ? introSteps(params) : []
  const lines = deferHitMessages(isFirstUpdate ? update.lines.filter((line) => !line.startsWith('|switch|')) : update.lines)
  return [...introPlan, ...lines.map((line) => ({ line, text: translateLine(line, params.translateContext) }))]
}

const lineType = (line: string): string => line.split('|')[1] ?? ''

/** `|switch|p1a: ...` (no `drag`: arrastrar no lleva bola): bando y si el Pokémon que sale seguía en pie (hay retirada). */
function switchAnimationFor(line: string, view: BattleView): SwitchAnimation | null {
  if (lineType(line) !== 'switch') return null
  const side = /^p([12])/.exec(line.split('|')[2] ?? '')?.[1] === '1' ? 'player' : 'rival'
  const previous = view[side].active === null ? null : view[side].team[view[side].active as number]
  return previous && !previous.fainted ? side : `${side}-send`
}

/**
 * Conecta la UI con el motor: cola de updates presentados uno a uno (texto y barras con pausas), y los controles
 * solo se activan cuando el último update se ha terminado de mostrar (RF-52, CMP-16).
 */
export function useBattle(params: BattleParams): BattleController {
  const [view, setView] = useState<BattleView | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [request, setRequest] = useState<BattleRequest | null>(null)
  const [lastChoiceRequest, setLastChoiceRequest] = useState<BattleRequest | null>(null)
  const [locked, setLocked] = useState(true)
  const [failed, setFailed] = useState(false)
  const [ended, setEnded] = useState<EngineEnd | null>(null)
  const [speed, setSpeed] = useState<BattleSpeed>(params.initialSpeed ?? 1)
  const [message, setMessage] = useState(null as string | null)
  const [introPhase, setIntroPhase] = useState((params.replay ? 'done' : 'loading') as IntroPhase)
  const [switchAnim, setSwitchAnim] = useState(null as SwitchAnimation | null)

  const wakeRef = useRef(null as (() => void) | null)
  const skipIntroRef = useRef(false)
  const introRunningRef = useRef(params.replay === undefined)
  const paramsRef = useRef(params)
  const speedRef = useRef(speed)
  const lockedRef = useRef(true)
  const forfeitSentRef = useRef(false)

  useEffect(() => {
    paramsRef.current = params
    speedRef.current = speed
  })

  useEffect(() => {
    const { client, init } = paramsRef.current
    const queue: Update[] = []
    const timers = new Set<ReturnType<typeof setTimeout>>()
    let cancelled = false
    let presenting = false
    let isFirstUpdate = true
    let shownView: EngineBattleView | null = null
    const replayPlan = paramsRef.current.replay ?? null
    let replayIndex = 0
    let replaying = replayPlan !== null
    if (replaying) skipIntroRef.current = true

    const sendDecision = (decision: Decision) => {
      if (decision.type === 'forfeit') client.forfeit()
      else client.choose({ type: decision.type, slot: decision.slot })
    }

    function failReplay() {
      replaying = false
      cancelled = true
      timers.forEach(clearTimeout)
      paramsRef.current.onReplayFailed?.()
    }

    const pause = (milliseconds: number, isIntro = false, skippable = true) =>
      new Promise<void>((resolve) => {
        if (replaying || (isIntro && skipIntroRef.current)) return resolve()
        const finish = () => {
          clearTimeout(timer)
          timers.delete(timer)
          wakeRef.current = null
          resolve()
        }
        const timer = setTimeout(finish, milliseconds / speedRef.current)
        timers.add(timer)
        wakeRef.current = skippable ? finish : null
      })

    async function present(update: Update) {
      const steps = stepsFor(update, isFirstUpdate, paramsRef.current)
      let shown: BattleView = isFirstUpdate ? update.view : (shownView ?? update.view)
      setView(shown)
      isFirstUpdate = false

      for (const step of steps) {
        if (cancelled) return
        if (step.phase) {
          setIntroPhase(skipIntroRef.current ? 'done' : step.phase)
          if (step.phase === 'done') introRunningRef.current = false
        }
        const switching = !replaying && step.line !== null && !step.phase ? switchAnimationFor(step.line, shown) : null
        if (switching) {
          setSwitchAnim(switching)
          if (!switching.endsWith('-send')) await pause(SWITCH_DURATIONS_MS.recall, false, false)
          if (cancelled) return
        }
        const isFaintLine = step.line !== null && lineType(step.line) === 'faint' && step.text !== null
        if (step.line !== null && !isFaintLine) {
          const reduced = viewReducer(shown, { type: 'lines', lines: [step.line] })
          shown = deferFaintUntilFaintLine(shown, reduced, step.line)
          setView(shown)
        }
        if (isFaintLine && step.text !== null) {
          // Orden del juego: la barra ya llegó a 0 -> mensaje -> el sprite cae.
          const text = step.text
          setLog((previous) => [...previous, text])
          setMessage(text)
          await pause(FAINT_MESSAGE_LEAD_MS)
          if (cancelled) return
          shown = viewReducer(shown, { type: 'lines', lines: [step.line as string] })
          setView(shown)
          await pause(TEXT_PAUSE_MS - FAINT_MESSAGE_LEAD_MS)
          continue
        }
        if (step.text !== null && step.line !== null && lineType(step.line) === 'turn') {
          // «Turno N» solo va al historial: el juego no lo enseña en la caja de mensajes.
          const text = step.text
          setLog((previous) => [...previous, text])
        } else if (step.text !== null) {
          const text = step.text
          setLog((previous) => [...previous, text])
          setMessage(text)
          await pause(step.wait ?? TEXT_PAUSE_MS, step.phase !== undefined)
        } else if (step.wait !== undefined) {
          await pause(step.wait, true)
        } else if (switching) {
          await pause(SWITCH_DURATIONS_MS.send)
        } else if (step.line !== null && VISUAL_LINE_TYPES.has(lineType(step.line))) {
          await pause(HP_LINE_TYPES.has(lineType(step.line)) ? HP_BAR_PAUSE_MS : VISUAL_PAUSE_MS)
        }
        if (switching) setSwitchAnim(null)
      }
      if (cancelled) return

      if (replaying && replayPlan) {
        const isLastDecision = replayIndex >= replayPlan.decisions.length
        if (update.ended && !isLastDecision) return failReplay()
        if (!update.ended && !isLastDecision) {
          shownView = update.view
          setView(update.view)
          sendDecision(replayPlan.decisions[replayIndex])
          replayIndex += 1
          return
        }
        replaying = false
        const expected = replayPlan.expected
        const reached = { turn: update.view.turn, playerRemaining: update.view.player.remaining, rivalRemaining: update.view.rival.remaining }
        const matches = expected === null || (expected.turn === reached.turn && expected.playerRemaining === reached.playerRemaining && expected.rivalRemaining === reached.rivalRemaining)
        if (!matches) return failReplay()
      }

      shownView = update.view
      setView(update.view)
      setRequest(update.request)
      if (update.request?.active || update.request?.forceSwitch) setLastChoiceRequest(update.request)
      if (!update.ended) paramsRef.current.onSettled?.({ turn: update.view.turn, playerRemaining: update.view.player.remaining, rivalRemaining: update.view.rival.remaining })
      if (update.ended) {
        setEnded(update.ended)
        await pause(FINISH_PAUSE_MS)
        if (!cancelled) paramsRef.current.onFinish(update.ended)
      } else if (queue.length === 0) {
        lockedRef.current = false
        setLocked(false)
      }
    }

    async function drain() {
      if (presenting) return
      presenting = true
      while (queue.length > 0 && !cancelled) await present(queue.shift() as Update)
      presenting = false
    }

    const unsubscribe = client.subscribe((message) => {
      if (message.type === 'error') {
        if (replaying) failReplay()
        else setFailed(true)
        return
      }
      lockedRef.current = true
      setLocked(true)
      queue.push(message)
      void drain()
    })
    client.init(init)

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      unsubscribe()
      client.terminate()
    }
  }, [])

  const choose = useCallback((choice: Choice) => {
    if (lockedRef.current) return
    lockedRef.current = true
    setLocked(true)
    paramsRef.current.onDecision?.({ type: choice.type, slot: choice.slot })
    paramsRef.current.client.choose(choice)
  }, [])

  const forfeit = useCallback(() => {
    if (forfeitSentRef.current) return
    forfeitSentRef.current = true
    lockedRef.current = true
    setLocked(true)
    paramsRef.current.onDecision?.({ type: 'forfeit' })
    paramsRef.current.client.forfeit()
  }, [])

  const advance = useCallback(() => {
    if (introRunningRef.current) skipIntroRef.current = true
    wakeRef.current?.()
  }, [])

  const cycleSpeed = useCallback(() => {
    const next = SPEEDS[(SPEEDS.indexOf(speedRef.current) + 1) % SPEEDS.length]
    speedRef.current = next
    setSpeed(next)
    paramsRef.current.onSpeedChange?.(next)
  }, [])

  return { view, log, message, introPhase, switchAnim, advance, request, lastChoiceRequest, canAct: !locked && !failed && ended === null, failed, ended, speed, cycleSpeed, choose, forfeit }
}
