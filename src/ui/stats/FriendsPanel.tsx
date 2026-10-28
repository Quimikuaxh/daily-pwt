import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CloudApi, PlayerRow } from '../../cloud/api'
import { esCloud } from '../../i18n/esCloud'
import './cloud.css'

const text = esCloud.friends

type Action = { (): Promise<unknown> }

/**
 * Amigos (RF-110, RF-111): buscar por nickname y enviar solicitud; aceptar o rechazar las recibidas, cancelar las enviadas y quitar amigos.
 * `onChange` avisa de que han cambiado las solicitudes (para el aviso de la cabecera).
 */
export function FriendsPanel({ api, onChange }: { api: CloudApi; onChange?: () => void }) {
  const [list, setList] = useState(null as PlayerRow[] | null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null as PlayerRow[] | null)
  const [error, setError] = useState(false)

  const reload = useCallback(() => api.listFriends().then(setList, () => setError(true)), [api])
  useEffect(() => {
    void reload()
  }, [reload])

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
      <FriendSection title={text.list}>
        {list !== null && friends.length === 0 && <li className="settings-hint">{text.none}</li>}
        {friends.map((row) => (
          <li key={row.nickname}>
            <span>{row.nickname}</span>
            <button type="button" className="btn btn-small" onClick={() => run(() => api.removeFriend(row.nickname))}>{text.remove}</button>
          </li>
        ))}
      </FriendSection>
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
