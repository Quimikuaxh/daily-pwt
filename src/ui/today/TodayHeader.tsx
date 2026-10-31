import { es } from '../../i18n/es'
import { AppMenu, type MenuContext } from '../menu/AppMenu'

type TodayHeaderProps = { challengeNumber: number | null; countdown: string; menu?: MenuContext; date?: string }

export function TodayHeader({ challengeNumber, countdown, menu, date }: TodayHeaderProps) {
  return (
    <header className="today-header">
      <div className="today-header-inner">
        <h1 className="logo" translate="no">
          <span className="logo-ball" aria-hidden="true" />
          <span className="logo-text">{es.app.name}</span>
        </h1>
        <div className="today-header-info">
          {challengeNumber !== null && <p className="challenge-number">{es.today.challengeNumber(challengeNumber)}</p>}
          <p className="countdown">
            <span className="countdown-label">{es.today.nextChallengeIn}</span>{' '}
            <time className="plate countdown-value">{countdown}</time>
          </p>
        </div>
        {menu && date && <AppMenu {...menu} today={date} welcome />}
      </div>
    </header>
  )
}
