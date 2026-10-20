import { useId, useState } from 'react'
import { useToday } from '../../hooks/useToday'
import type { Challenge, GameData } from '../../core/types'
import { es } from '../../i18n/es'
import { PlayerCard } from './PlayerCard'
import { RivalSection } from './RivalSection'
import { TodayFooter } from './TodayFooter'
import { TodayHeader } from './TodayHeader'

type TodayScreenProps = {
  data: GameData | null
  onStart: (challenge: Challenge, leadIndex: number) => void
  /** Solo con los ganchos de prueba (?date=). */
  dateOverride?: string
}

type TodayContentProps = {
  challenge: Challenge
  data: GameData
  onStart: TodayScreenProps['onStart']
}

function TodayContent({ challenge, data, onStart }: TodayContentProps) {
  const playerHeadingId = useId()
  const hintId = useId()
  const [leadIndex, setLeadIndex] = useState(null as number | null)
  const canFight = leadIndex !== null

  return (
    <>
      <RivalSection challenge={challenge} data={data} />

      <section aria-labelledby={playerHeadingId} className="panel">
        <h2 id={playerHeadingId} className="section-title">{es.today.playerSection}</h2>
        <p className="section-hint">{es.today.playerSectionHint}</p>
        <div className="player-grid">
          {challenge.playerTeam.map((set, index) => (
            <PlayerCard key={`${set.species}-${index}`} set={set} data={data} isLead={leadIndex === index} onChooseLead={() => setLeadIndex(index)} />
          ))}
        </div>
      </section>

      <div className="fight-bar">
        <button
          type="button"
          className="btn btn-primary btn-fight"
          disabled={!canFight}
          aria-describedby={canFight ? undefined : hintId}
          onClick={() => leadIndex !== null && onStart(challenge, leadIndex)}
        >
          {es.today.fight}
        </button>
        {!canFight && <p id={hintId} className="fight-hint">{es.today.fightHint}</p>}
      </div>
    </>
  )
}

export function TodayScreen({ data, onStart, dateOverride }: TodayScreenProps) {
  const { challenge, countdown, error } = useToday(data, dateOverride)

  return (
    <div className="page">
      <a href="#main" className="skip-link">{es.app.skipToContent}</a>
      <TodayHeader challengeNumber={challenge?.number ?? null} countdown={countdown} />
      <main id="main" tabIndex={-1} className="page-main">
        {challenge && data ? (
          <TodayContent key={challenge.date} challenge={challenge} data={data} onStart={onStart} />
        ) : (
          <p role="alert" className="alert">{error ?? es.today.dataError}</p>
        )}
      </main>
      <TodayFooter />
    </div>
  )
}
