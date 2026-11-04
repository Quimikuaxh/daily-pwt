import { useCallback, useEffect, useState } from 'react'
import type { CloudApi, LiveInbox } from '../../cloud/api'
import { esCloud } from '../../i18n/esCloud'

const text = esCloud.live
/** Cada cuánto mira quien juega si alguien pide ver su combate. */
export const LIVE_INBOX_POLL_MS = 8000

/** Solicitudes para ver en directo el oficial en curso (RF-111c): se piden cada `LIVE_INBOX_POLL_MS` mientras `active`. */
export function useLiveInbox(api: CloudApi | undefined, active: boolean) {
  const [inbox, setInbox] = useState({ pending: [], watching: 0 } as LiveInbox)
  const load = useCallback(() => {
    api?.liveInbox().then(setInbox, () => {})
  }, [api])
  useEffect(() => {
    if (!api || !active) return
    load()
    const timer = setInterval(load, LIVE_INBOX_POLL_MS)
    return () => clearInterval(timer)
  }, [api, active, load])
  const answer = useCallback(
    (nickname: string, accept: boolean) => {
      if (!api) return
      // Se quita al momento; el servidor lo confirma en la siguiente consulta.
      setInbox((current) => ({ pending: current.pending.filter((name) => name !== nickname), watching: current.watching + (accept ? 1 : 0) }))
      api.answerLiveRequest(nickname, accept).then(load, load)
    },
    [api, load],
  )
  return { inbox, answer }
}

/** El aviso en la fila de los Pokémon en pie, que se sustituye mientras dura (no tapa ni el combate ni sus botones). */
export function LiveRequestRow({ nickname, onAnswer }: { nickname: string; onAnswer: (accept: boolean) => void }) {
  return (
    <div className="bt-live-request" role="alert">
      <span className="bt-live-request-text">{text.asks(nickname)}</span>
      <button type="button" className="btn btn-small" onClick={() => onAnswer(true)}>{text.accept}</button>
      <button type="button" className="btn btn-small btn-secondary" onClick={() => onAnswer(false)}>{text.reject}</button>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg className="bt-live-eye" viewBox="0 0 11 7" width="22" height="14" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M3 0h5v1H3zM1 1h2v1H1zM8 1h2v1H8zM0 2h1v3H0zM10 2h1v3H10zM1 5h2v1H1zM8 5h2v1H8zM3 6h5v1H3zM4 2h3v3H4z" fill="currentColor" />
    </svg>
  )
}

/** Cuántos amigos le están viendo, junto a los contadores. */
export function LiveWatching({ count }: { count: number }) {
  return (
    <span className="bt-live-watching" role="img" aria-label={text.watching(count)} title={text.watching(count)}>
      <EyeIcon />
      <span aria-hidden="true">{count}</span>
    </span>
  )
}
