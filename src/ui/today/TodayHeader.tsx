import { es } from '../../i18n/es'

type TodayHeaderProps = { challengeNumber: number | null; countdown: string }

export function TodayHeader({ challengeNumber, countdown }: TodayHeaderProps) {
  return (
    <header className="today-header">
      <div className="today-header-inner">
        <h1 className="logo" translate="no">
          <span className="logo-ball" aria-hidden="true" />
          {es.app.name}
        </h1>
        <div className="today-header-info">
          {challengeNumber !== null && <p className="challenge-number">{es.today.challengeNumber(challengeNumber)}</p>}
          <p className="countdown">
            <span className="countdown-label">{es.today.nextChallengeIn}</span>{' '}
            <time className="countdown-value">{countdown}</time>
          </p>
        </div>
      </div>
    </header>
  )
}
