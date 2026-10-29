import { useEffect, useRef, useState } from 'react'
import { getAudio } from '../../audio/audio'
import type { GameData } from '../../core/types'
import { es } from '../../i18n/es'
import { esReplay } from '../../i18n/esReplay'
import { ReplayClient } from '../../replay/replayClient'
import type { ReplayData } from '../../replay/replayData'
import type { Settings } from '../../storage/settings'
import { BattleScreen, type ReplayTeam } from '../battle/BattleScreen'
import './replay.css'

const text = esReplay.viewer
/** Pausa entre turnos con «Reproducir», a x1 (se divide por la velocidad de Ajustes, RF-129). */
const AUTOPLAY_PAUSE_MS = 700

type ReplayViewerProps = {
  replay: ReplayData
  data: GameData
  settings: Settings
  onExit: () => void
  /** Solo si la ve quien la compartió (RF-133): «Borrar enlace». */
  onDelete?: () => void
  /** La repetición es de quien la ve: su botón dice «Tu equipo»; si no, «Equipo». */
  own?: boolean
}

/**
 * Pasos en los que la repetición se para entre turnos: el principio, el primero de cada turno nuevo (el estado al acabar el anterior) y el
 * último. Un cambio forzado dentro del turno es otro paso del mismo turno: no se para en él.
 */
function restSteps(replay: ReplayData): number[] {
  const last = replay.steps.length - 1
  const rests = [0]
  for (let index = 1; index < last; index++) if (replay.steps[index].view.turn !== replay.steps[index - 1].view.turn) rests.push(index)
  if (last > 0) rests.push(last)
  return rests
}

function nextRestOf(rests: number[], index: number, last: number): number {
  return rests.find((rest) => rest > index) ?? last
}

function previousRestOf(rests: number[], index: number): number {
  return [...rests].reverse().find((rest) => index > rest) ?? 0
}

/** Turno cuyas acciones acaban en el paso `index` (0: el inicio, antes del primero). */
const turnShownAt = (replay: ReplayData, index: number) => (index === 0 ? 0 : replay.steps[index - 1].view.turn)

/**
 * Repetición de un oficial (F5, RF-127 a RF-130): la pantalla de combate alimentada con los pasos grabados (`ReplayClient`), sin menús.
 * Avanzar emite los pasos del turno siguiente, con sus mensajes y animaciones. Ir atrás o saltar vuelve a montar la pantalla en ese paso
 * con el avance rápido de la reanudación (sin animación ni intro). «Reproducir» avanza solo al terminar cada turno.
 */
export function ReplayViewer({ replay, data, settings, onExit, onDelete, own = true }: ReplayViewerProps) {
  const last = replay.steps.length - 1
  // `start`: paso en el que se monta la pantalla; `mount` la vuelve a montar aunque el paso sea el mismo.
  const [position, setPosition] = useState({ start: 0, mount: 0 })
  const [client, setClient] = useState(() => new ReplayClient(replay.steps))
  const [shown, setShown] = useState(0)
  const [busy, setBusy] = useState(true)
  const [playing, setPlaying] = useState(false)
  // Paso desde el que se está reproduciendo un turno (para el rótulo y para terminarlo al instante); `null` en reposo, en la intro o al saltar.
  const [playingFrom, setPlayingFrom] = useState(null as number | null)
  const targetRef = useRef(0)
  const [rests] = useState(() => restSteps(replay))
  const nextRest = (index: number) => nextRestOf(rests, index, last)
  const previousRest = (index: number) => previousRestOf(rests, index)

  function seek(step: number) {
    setPlayingFrom(null)
    targetRef.current = step
    setShown(step)
    setBusy(true)
    setClient(new ReplayClient(replay.steps))
    setPosition((current) => ({ start: step, mount: current.mount + 1 }))
  }

  /**
   * «Turno siguiente» (RF-128): directo, salta al final del turno siguiente sin animación (como «Turno anterior»). Si «Reproducir» está
   * enseñando un turno, lo termina al instante.
   */
  function forward() {
    if (busy && playingFrom !== null) {
      seek(targetRef.current)
      return
    }
    if (!busy && shown !== last) seek(nextRest(shown))
  }

  /** «Reproducir»: emite los pasos del turno siguiente y la pantalla los presenta en orden, con sus mensajes y animaciones. */
  function playNext() {
    if (busy || shown === last) {
      return
    }
    const target = nextRest(shown)
    targetRef.current = target
    setPlayingFrom(shown)
    setBusy(true)
    while (client.emitted <= target && !client.finished) {
      client.next()
    }
  }

  function settled() {
    const reached = client.emitted - 1
    setShown(reached)
    if (reached === targetRef.current) {
      setBusy(false)
      setPlayingFrom(null)
    }
  }

  // Reproducir: al quedar quieta la pantalla, el turno siguiente tras una pausa. `playNext` cambia en cada render; va por ref.
  const playNextRef = useRef(playNext)
  useEffect(() => {
    playNextRef.current = playNext
  })
  useEffect(() => {
    if (!playing || busy || shown === last) return
    const pending = setTimeout(() => playNextRef.current(), AUTOPLAY_PAUSE_MS / settings.speed)
    return () => clearTimeout(pending)
  }, [playing, busy, shown, last, settings.speed])

  // La música del rival la arranca la pantalla de combate y sigue entre saltos (cada salto la vuelve a montar); se para al salir del visor.
  useEffect(() => {
    const audio = getAudio()
    return () => audio.stopMusic()
  }, [])

  const ended = replay.ended
  const atEnd = shown === last && !busy
  const turn = busy && playingFrom !== null ? replay.steps[playingFrom].view.turn : turnShownAt(replay, shown)
  const totalTurns = ended?.turns ?? replay.steps[last].view.turn
  return (
    <BattleScreen
      key={position.mount}
      client={client}
      data={data}
      challenge={replay.challenge}
      playerLead={replay.playerLead}
      battleSeed={replay.battleSeed}
      ai={replay.ai}
      mode="replay"
      controls={(openTeam) => (
        <ReplayControls
          label={atEnd ? (resultText(replay) ?? text.turnOf(totalTurns, totalTurns)) : turn === 0 ? text.intro : text.turnOf(turn, totalTurns)}
          atStart={shown === 0}
          skippable={busy && playingFrom !== null}
          atEnd={atEnd}
          atLast={shown === last}
          busy={busy}
          playing={playing && !atEnd}
          onStart={() => seek(0)}
          onPrevious={() => seek(previousRest(busy && playingFrom !== null ? playingFrom + 1 : shown))}
          onTogglePlay={() => setPlaying(!playing)}
          onNext={forward}
          onEnd={() => seek(last)}
          onExit={onExit}
          onDelete={onDelete}
          playerTeamLabel={own ? text.ownTeam : text.playerTeam}
          onTeam={openTeam}
        />
      )}
      // Saltar a un paso: el avance rápido de la reanudación emite y pinta los pasos hasta él, sin animación ni intro.
      replay={position.start > 0 ? { decisions: Array.from({ length: position.start }, () => ({ type: 'move' as const, slot: 1 })), expected: null } : undefined}
      onSettled={settled}
      // «Pausa» a mitad de un turno lo deja quieto en ese mensaje (RF-128); «Reproducir» lo sigue desde ahí.
      paused={!playing && playingFrom !== null}
      onFinish={() => {
        setShown(last)
        setBusy(false)
        setPlaying(false)
        setPlayingFrom(null)
      }}
      initialSpeed={settings.speed}
      animations={settings.animations}
      onExit={onExit}
    />
  )
}

/** Resultado del final («Victoria · 23 turnos · 4/6 en pie»), si la repetición tiene final. */
function resultText(replay: ReplayData): string | null {
  const ended = replay.ended
  if (!ended) return null
  return ended.result === 'win' ? es.today.official.won(ended.turns, ended.playerAlive) : es.today.official.lost(ended.turns, ended.playerAlive)
}

type ReplayControlsProps = {
  label: string
  atStart: boolean
  atEnd: boolean
  atLast: boolean
  busy: boolean
  /** Se está reproduciendo un turno: «Turno siguiente» lo termina al instante. */
  skippable: boolean
  playing: boolean
  onStart: () => void
  onPrevious: () => void
  onTogglePlay: () => void
  onNext: () => void
  onEnd: () => void
  onExit: () => void
  onDelete?: () => void
  playerTeamLabel: string
  /** Abre la pantalla de equipo de un bando (decisión de Jose, 29/10/2026: dos botones, el rival entero). */
  onTeam: (side: ReplayTeam) => void
}

/**
 * Iconos en píxel (viewBox de 10 × 10, como los de la cabecera), centrados en su botón. «Turno anterior» y «Al principio» son el espejo de
 * «Turno siguiente» y «Al final»: el mismo dibujo invertido (decisión de Jose, 29/10/2026).
 */
const ICONS = {
  play: 'M3 1h1v8H3zM4 2h1v6H4zM5 3h1v4H5zM6 4h1v2H6z',
  pause: 'M2 1h2v8H2zM6 1h2v8H6z',
  next: 'M1 1h1v8H1zM2 2h1v6H2zM3 3h1v4H3zM4 4h1v2H4zM5 1h1v8H5zM6 2h1v6H6zM7 3h1v4H7zM8 4h1v2H8z',
  end: 'M1 1h1v8H1zM2 2h1v6H2zM3 3h1v4H3zM4 4h1v2H4zM7 1h2v8H7z',
} as const

const MIRRORED = { previous: 'next', start: 'end' } as const

function ControlIcon({ icon }: { icon: keyof typeof ICONS | keyof typeof MIRRORED }) {
  const mirrored = icon in MIRRORED
  const path = ICONS[mirrored ? MIRRORED[icon as keyof typeof MIRRORED] : (icon as keyof typeof ICONS)]
  return (
    <svg className="rp-icon" viewBox="0 0 10 10" width="20" height="20" aria-hidden="true" shapeRendering="crispEdges">
      <path d={path} fill="currentColor" transform={mirrored ? 'matrix(-1 0 0 1 10 0)' : undefined} />
    </svg>
  )
}

/**
 * Barra de la pantalla táctil (RF-128): al principio y turno anterior a la izquierda, reproducir/pausa en el centro, turno siguiente y al
 * final a la derecha, con el turno que se está viendo o el resultado.
 */
function ReplayControls(props: ReplayControlsProps) {
  return (
    <div className="rp-controls">
      <p className="rp-turn" aria-live="polite">{props.label}</p>
      <div className="rp-buttons" role="group" aria-label={text.controls}>
        <div className="rp-group">
          <button type="button" className="rp-button" aria-label={text.start} title={text.start} disabled={props.atStart && !props.busy} onClick={props.onStart}><ControlIcon icon="start" /></button>
          <button type="button" className="rp-button" aria-label={text.previous} title={text.previous} disabled={props.atStart} onClick={props.onPrevious}><ControlIcon icon="previous" /></button>
        </div>
        <button type="button" className="rp-button rp-play" aria-label={props.playing ? text.pause : text.play} title={props.playing ? text.pause : text.play} disabled={props.atEnd} onClick={props.onTogglePlay}>
          <ControlIcon icon={props.playing ? 'pause' : 'play'} />
        </button>
        <div className="rp-group">
          <button type="button" className="rp-button" aria-label={text.next} title={text.next} disabled={(props.busy && !props.skippable) || props.atLast} onClick={props.onNext}><ControlIcon icon="next" /></button>
          <button type="button" className="rp-button" aria-label={text.end} title={text.end} disabled={props.atLast} onClick={props.onEnd}><ControlIcon icon="end" /></button>
        </div>
      </div>
      <div className="rp-actions">
        {/* Rival a la izquierda, Volver en el centro y el equipo del jugador a la derecha (decisión de Jose, 29/10/2026). */}
        <button type="button" className="rp-text-button" onClick={() => props.onTeam('rival')}>{text.rivalTeam}</button>
        <button type="button" className="rp-text-button" onClick={props.onExit}>{es.battle.back}</button>
        <button type="button" className="rp-text-button" onClick={() => props.onTeam('player')}>{props.playerTeamLabel}</button>
        {props.onDelete && <button type="button" className="rp-text-button rp-danger" onClick={props.onDelete}>{text.deleteLink}</button>}
      </div>
    </div>
  )
}
