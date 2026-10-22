import { MAX_TURNS } from '../../config'
import type { EngineEnd } from '../../battle/protocol'
import { TEAM_SIZE } from '../../core/constants'
import { es } from '../../i18n/es'
import type { BattleMode } from '../../storage/gameStore'

type ResultScreenProps = {
  ended: EngineEnd
  onBackToToday: () => void
  onRematch: () => void
  /** Qué combate acaba de terminar: el oficial queda registrado, la práctica no cuenta para nada. */
  mode?: BattleMode
}


function defeatReason(ended: EngineEnd): string {
  const reasons = es.result.defeatReasons
  return ended.reason === 'turnLimit' ? reasons.turnLimit(MAX_TURNS) : reasons[ended.reason]
}

export function ResultScreen({ ended, onBackToToday, onRematch, mode }: ResultScreenProps) {
  const won = ended.result === 'win'

  return (
    <main className="result-screen">
      <section className={won ? 'result-panel plate result-win' : 'result-panel plate result-loss'}>
        <h1 className="result-title">{won ? es.result.victory : es.result.defeat}</h1>
        <p className="result-lead namebox">{won ? es.result.victoryLead : defeatReason(ended)}</p>
        <ul className="result-stats">
          <li>{es.result.turns(ended.turns)}</li>
          <li>{es.result.alive(ended.playerAlive)}</li>
          {!won && <li>{es.result.rivalFainted(ended.rivalFainted, TEAM_SIZE)}</li>}
        </ul>
        {mode && <p className="result-note">{mode === 'official' ? es.result.officialRecorded : es.result.practiceNote}</p>}
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch}>{es.result.rematch}</button>
          <button type="button" className="btn btn-secondary" onClick={onBackToToday}>{es.result.backToToday}</button>
        </div>
      </section>
    </main>
  )
}
