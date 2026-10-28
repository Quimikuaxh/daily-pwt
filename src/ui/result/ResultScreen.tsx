import { useEffect, useState } from 'react'
import { getAudio, VICTORY_MUSIC } from '../../audio/audio'
import { MAX_TURNS } from '../../config'
import type { EngineEnd } from '../../battle/protocol'
import { TEAM_SIZE } from '../../core/constants'
import { es } from '../../i18n/es'
import type { BattleMode, GameStore } from '../../storage/gameStore'
import { useCountdown } from '../../hooks/useToday'
import { computeStats } from '../../storage/playerStats'
import { AppMenu, type MenuContext } from '../menu/AppMenu'
import { ShareButton } from '../share/ShareButton'
import { shareResult, shareTextFor } from '../share/shareText'
import { StatsPanel } from '../stats/StatsPanel'

/** Crea el enlace de la repetición y lo devuelve. */
type ShareReplay = { (): Promise<string> }

type ResultScreenProps = {
  ended: EngineEnd
  onBackToToday: () => void
  onRematch: () => void
  /** Qué combate acaba de terminar: el oficial queda registrado, la práctica no cuenta para nada. */
  mode?: BattleMode
  /** Historial y fecha del reto del combate: estadísticas actualizadas y texto para compartir del oficial. */
  store?: GameStore
  date?: string
  /** Estadísticas, Ayuda y Ajustes. */
  menu?: MenuContext
  /**
   * F5, RF-135: repetición del oficial que acaba de terminar. `onShare` (solo con sesión) crea el enlace y lo devuelve.
   */
  replay?: { onWatch: () => void; onShare?: ShareReplay }
}


/** «Ver repetición» y «Compartir» (copia el enlace; si no se puede, lo deja a la vista para copiarlo a mano). */
function ReplayActions({ replay }: { replay: NonNullable<ResultScreenProps['replay']> }) {
  const [status, setStatus] = useState(null as { message: string; link?: string } | null)

  async function share(onShare: ShareReplay) {
    setStatus({ message: es.result.replaySharing })
    try {
      const link = await onShare()
      const outcome = await shareResult(link)
      setStatus(outcome === 'copied' ? { message: es.result.replayCopied } : { message: es.result.replayCopyFailed, link })
    } catch {
      setStatus({ message: es.result.replayShareFailed })
    }
  }

  return (
    <div className="result-replay">
      <div className="result-actions">
        <button type="button" className="btn btn-secondary" onClick={replay.onWatch}>{es.result.watchReplay}</button>
        {replay.onShare && (
          <button type="button" className="btn btn-secondary" onClick={() => void share(replay.onShare as ShareReplay)}>{es.result.shareReplay}</button>
        )}
      </div>
      <p className="share-status" role="status">
        {status?.message} {status?.link && <span className="result-replay-link">{status.link}</span>}
      </p>
    </div>
  )
}

function defeatReason(ended: EngineEnd): string {
  const reasons = es.result.defeatReasons
  return ended.reason === 'turnLimit' ? reasons.turnLimit(MAX_TURNS) : reasons[ended.reason]
}

function OfficialSummary({ store, date }: { store: GameStore; date: string }) {
  const days = store.listDays()
  const text = shareTextFor(days, date)
  return (
    <>
      <StatsPanel stats={computeStats(days, date)} />
      {text && <ShareButton text={text} />}
    </>
  )
}

export function ResultScreen({ ended, onBackToToday, onRematch, mode, store, date, menu, replay }: ResultScreenProps) {
  const won = ended.result === 'win'
  // Jingle de victoria (DEC-57): una vez si se gana (perder o rendirse no suena); se corta al salir de Resultado.
  useEffect(() => {
    if (!won) return
    const audio = getAudio()
    audio.playMusic(VICTORY_MUSIC)
    return () => audio.stopMusic()
  }, [won])
  const countdown = useCountdown()

  return (
    <main className="result-screen">
      {menu && date && (
        <div className="result-toolbar">
          <AppMenu {...menu} today={date} />
        </div>
      )}
      <section className={won ? 'result-panel plate result-win' : 'result-panel plate result-loss'}>
        <h1 className="result-title">{won ? es.result.victory : es.result.defeat}</h1>
        <p className="result-lead namebox">{won ? es.result.victoryLead : defeatReason(ended)}</p>
        <ul className="result-stats">
          <li>{es.result.turns(ended.turns)}</li>
          <li>{es.result.alive(ended.playerAlive)}</li>
          {!won && <li>{es.result.rivalFainted(ended.rivalFainted, TEAM_SIZE)}</li>}
        </ul>
        {mode && <p className="result-note">{mode === 'official' ? es.result.officialRecorded : es.result.practiceNote}</p>}
        {mode === 'official' && store && date && <OfficialSummary store={store} date={date} />}
        <p className="countdown result-countdown">
          <span className="countdown-label">{es.today.nextChallengeIn}</span>{' '}
          <time className="plate countdown-value">{countdown}</time>
        </p>
        {replay && <ReplayActions replay={replay} />}
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch}>{es.result.rematch}</button>
          <button type="button" className="btn btn-secondary" onClick={onBackToToday}>{es.result.backToToday}</button>
        </div>
      </section>
    </main>
  )
}
