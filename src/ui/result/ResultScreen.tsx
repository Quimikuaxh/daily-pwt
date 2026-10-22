import { MAX_TURNS } from '../../config'
import type { EngineEnd } from '../../battle/protocol'
import { TEAM_SIZE } from '../../core/constants'
import { es } from '../../i18n/es'
import type { BattleMode, GameStore } from '../../storage/gameStore'
import { useCountdown } from '../../hooks/useToday'
import { computeStats } from '../../storage/playerStats'
import { AppMenu, type MenuContext } from '../menu/AppMenu'
import { ShareButton } from '../share/ShareButton'
import { shareTextFor } from '../share/shareText'
import { StatsPanel } from '../stats/StatsPanel'

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

export function ResultScreen({ ended, onBackToToday, onRematch, mode, store, date, menu }: ResultScreenProps) {
  const won = ended.result === 'win'
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
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch}>{es.result.rematch}</button>
          <button type="button" className="btn btn-secondary" onClick={onBackToToday}>{es.result.backToToday}</button>
        </div>
      </section>
    </main>
  )
}
