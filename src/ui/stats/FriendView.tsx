import { useEffect, useState } from 'react'
import type { CloudApi, FriendProfile, HistoryItem } from '../../cloud/api'
import { esCloud } from '../../i18n/esCloud'
import { Loading } from '../common/Loading'
import { HistoryList } from '../replay/MatchHistoryDialog'
import type { HistoryArt } from '../replay/historyArt'
import { StatsSummary } from './StatsSummary'
import './cloud.css'

const text = esCloud.friends

type FriendViewProps = {
  api: CloudApi
  nickname: string
  today: string
  onBack: () => void
  /** Con ellos, su historial con «Ver repetición»; sin ellos, solo las estadísticas. */
  trainerName?: (trainerId: string) => string
  art?: (item: HistoryItem) => HistoryArt | null
  onWatch?: (nickname: string, date: string) => void
}

/**
 * Vista de un amigo (decisión de Jose, 29/10/2026): sus estadísticas, iguales que las de «Yo», y su historial con sus repeticiones, solo
 * para ver (sin compartir ni borrar). El servidor solo da los días ya cerrados: su combate de hoy no se ve hasta la medianoche de Madrid.
 */
export function FriendView({ api, nickname, today, onBack, trainerName, art, onWatch }: FriendViewProps) {
  const [profile, setProfile] = useState(null as FriendProfile | null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    api.friendProfile(nickname).then(
      (loaded) => active && setProfile(loaded),
      () => active && setFailed(true),
    )
    return () => {
      active = false
    }
  }, [api, nickname])

  return (
    <div className="friend-view">
      <div className="friend-view-head">
        <button type="button" className="btn btn-small" onClick={onBack}>{text.back}</button>
        <h3 className="friend-view-name">{profile?.nickname ?? nickname}</h3>
      </div>
      <FriendBody profile={profile} failed={failed} today={today} trainerName={trainerName} art={art} onWatch={onWatch} />
    </div>
  )
}

function FriendBody({ profile, failed, today, trainerName, art, onWatch }: { profile: FriendProfile | null; failed: boolean } & Pick<FriendViewProps, 'today' | 'trainerName' | 'art' | 'onWatch'>) {
  if (failed) {
    return <p className="settings-status" role="alert">{text.profileFailed}</p>
  }
  if (profile === null) {
    return <Loading label={text.loading} />
  }
  // El combate de hoy sale, pero su repetición no hasta mañana (RF-111b; Jose, 31/10/2026).
  const beforeToday = (item: { date: string }) => {
    return item.date < today
  }
  return (
    <>
      <StatsSummary days={profile.days} today={today} points={profile.points} own={false} note={text.todayHidden} />
      {trainerName && onWatch && (
        <section className="friends-section">
          <h3 className="help-title">{text.history}</h3>
          {profile.history.length === 0 && <p className="settings-hint">{text.noHistory}</p>}
          <HistoryList items={profile.history} trainerName={trainerName} art={art} onWatch={(date) => onWatch(profile.nickname, date)} canWatch={beforeToday} />
        </section>
      )}
    </>
  )
}
