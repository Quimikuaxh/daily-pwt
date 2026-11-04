import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CloudApi, PlayerRow } from '../../cloud/api'
import { esCloud } from '../../i18n/esCloud'
import './cloud.css'
import { Loading } from '../common/Loading'

const text = esCloud.friends

type Action = { (): Promise<unknown> }

/**
 * Amigos (RF-110, RF-111): buscar por nickname y enviar solicitud; aceptar o rechazar las recibidas, cancelar las enviadas y quitar amigos.
 * `onChange` avisa de que han cambiado las solicitudes (para el aviso de la cabecera).
 */
/** Mientras haya amigos jugando, la lista se vuelve a pedir cada tanto: así se ve si aceptan la solicitud de verlos en directo. */
export const FRIENDS_POLL_MS = 5000

export function FriendsPanel({ api, onChange, onOpen, onWatchLive }: { api: CloudApi; onChange?: () => void; onOpen?: (nickname: string) => void; onWatchLive?: (nickname: string) => void }) {
  const [list, setList] = useState(null as PlayerRow[] | null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null as PlayerRow[] | null)
  const [error, setError] = useState(false)

  const reload = useCallback(() => api.listFriends().then(setList, () => setError(true)), [api])
  useEffect(() => {
    void reload()
  }, [reload])
  const anyPlaying = (list ?? []).some((row) => row.relation === 'friend' && row.playing)
  // Depende de si hay directo, no de la función: quien la pasa la crea en cada render (Hoy se repinta cada segundo con la cuenta atrás)
  // y el temporizador se borraba antes de dispararse (prueba de Jose, 04/11/2026).
  const liveEnabled = Boolean(onWatchLive)
  useEffect(() => {
    if (!anyPlaying || !liveEnabled) return
    const timer = setInterval(() => void reload(), FRIENDS_POLL_MS)
    return () => clearInterval(timer)
  }, [anyPlaying, liveEnabled, reload])

  async function run(action: Action) {
    setError(false)
    try {
      await action()
      await reload()
      if (results) setResults(await api.searchPlayers(query.trim()))
      onChange?.()
    } catch {
      setError(true)
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setError(false)
    api.searchPlayers(trimmed).then(setResults, () => setError(true))
  }

  function byRelation(relation: PlayerRow['relation']) {
    return (list ?? []).filter((row) => row.relation === relation)
  }
  const incoming = byRelation('incoming')
  const outgoing = byRelation('outgoing')
  const friends = byRelation('friend')

  return (
    <div className="friends-panel">
      <form className="nickname-form" onSubmit={search} role="search">
        <label htmlFor="friend-search">{text.searchLabel}</label>
        <input id="friend-search" className="text-input" value={query} maxLength={16} autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit" className="btn btn-small">{text.search}</button>
      </form>
      {results && (
        <ul className="friends-list" aria-label={text.search}>
          {results.length === 0 && <li className="settings-hint">{text.noResults}</li>}
          {results.map((row) => (
            <li key={row.nickname}>
              <span>{row.nickname}</span>
              {row.relation === 'none' && <button type="button" className="btn btn-small" onClick={() => run(() => api.sendFriendRequest(row.nickname))}>{text.add}</button>}
              {row.relation === 'outgoing' && <span className="settings-hint">{text.requested}</span>}
              {row.relation === 'incoming' && <button type="button" className="btn btn-small" onClick={() => run(() => api.respondFriendRequest(row.nickname, true))}>{text.accept}</button>}
              {row.relation === 'friend' && <span className="settings-hint">{text.alreadyFriend}</span>}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="settings-status" role="alert">{text.failed}</p>}
      {list === null && !error && <Loading label={text.loading} />}
      {incoming.length > 0 && (
        <FriendSection title={text.incoming}>
          {incoming.map((row) => (
            <li key={row.nickname}>
              <span>{row.nickname}</span>
              <button type="button" className="btn btn-small" onClick={() => run(() => api.respondFriendRequest(row.nickname, true))}>{text.accept}</button>
              <button type="button" className="btn btn-small" onClick={() => run(() => api.respondFriendRequest(row.nickname, false))}>{text.reject}</button>
            </li>
          ))}
        </FriendSection>
      )}
      {outgoing.length > 0 && (
        <FriendSection title={text.outgoing}>
          {outgoing.map((row) => (
            <li key={row.nickname}>
              <span>{row.nickname}</span>
              <button type="button" className="btn btn-small" onClick={() => run(() => api.cancelFriendRequest(row.nickname))}>{text.cancel}</button>
            </li>
          ))}
        </FriendSection>
      )}
      {list !== null && <FriendSection title={text.list}>
        {friends.length === 0 && <li className="settings-hint">{text.none}</li>}
        {friends.map((row) => (
          <li key={row.nickname}>
            {/* Al pulsarlo, sus estadísticas e historial (decisión de Jose, 29/10/2026). */}
            {onOpen ? (
              <button type="button" className="friend-open" aria-label={text.open(row.nickname)} onClick={() => onOpen(row.nickname)}>{row.nickname}</button>
            ) : (
              <span>{row.nickname}</span>
            )}
            {row.playing && onWatchLive && <LiveControl row={row} onRequest={() => run(() => api.requestLive(row.nickname))} onWatch={() => onWatchLive(row.nickname)} />}
            <button type="button" className="btn btn-small" onClick={() => run(() => api.removeFriend(row.nickname))}>{text.remove}</button>
          </li>
        ))}
      </FriendSection>}
    </div>
  )
}

function FriendSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="friends-section">
      <h3 className="help-title">{title}</h3>
      <ul className="friends-list">{children}</ul>
    </section>
  )
}

/** RF-111c: un amigo jugando su oficial; según la solicitud de hoy, pedirla, esperar, volver a pedirla o verlo. */
function LiveControl({ row, onRequest, onWatch }: { row: PlayerRow; onRequest: () => void; onWatch: () => void }) {
  return (
    <span className="friend-live">
      <span className="friend-playing">{text.playing}</span>
      {row.live === 'accepted' && <button type="button" className="btn btn-small" aria-label={text.watchLiveAria(row.nickname)} onClick={onWatch}>{text.watchLive}</button>}
      {row.live === 'pending' && <span className="settings-hint">{text.livePending}</span>}
      {row.live === 'rejected' && <span className="settings-hint">{text.liveRejected}</span>}
      {(!row.live || row.live === 'rejected') && (
        <button type="button" className="btn btn-small" aria-label={text.liveRequestAria(row.nickname)} onClick={onRequest}>{row.live === 'rejected' ? text.liveAgain : text.requestLive}</button>
      )}
    </span>
  )
}
