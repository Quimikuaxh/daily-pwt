import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CloudError } from '../../cloud/api'
import type { Account } from '../../cloud/account'
import type { AccountState } from '../../cloud/state'
import { releaseGoogleButton, renderGoogleButton, type GoogleCredential } from '../../cloud/googleIdentity'
import { esCloud } from '../../i18n/esCloud'
import { Modal } from '../common/Modal'
import '../stats/cloud.css'
import { Loading } from '../common/Loading'

const text = esCloud.account
const NICKNAME = /^[A-Za-z0-9_]{3,16}$/

/** Ventana «Cuenta» del icono de la cabecera (RF-93 a RF-96): iniciar sesión con Google, cambiar el nickname y cerrar sesión. */
export function AccountDialog({ account, state, onClose, onOpenHistory }: { account: Account; state: AccountState; onClose: () => void; onOpenHistory?: () => void }) {
  const player = state.status === 'signedIn' || state.status === 'guest'
  return (
    <Modal title={text.title} onClose={onClose} className="account-dialog">
      {player ? <Player account={account} state={state} /> : <Unavailable state={state} />}
      {/* F5, RF-124: solo en el móvil (en pantallas anchas está el icono de la cabecera); el CSS lo oculta en las anchas. */}
      {player && onOpenHistory && (
        <div className="account-actions account-history-mobile">
          <button type="button" className="btn btn-small" onClick={onOpenHistory}>{text.history}</button>
        </div>
      )}
    </Modal>
  )
}

/**
 * Botón oficial de Google (DEC-70): Google pinta el suyo y devuelve la credencial sin salir de la página. *Descartado:* el botón propio
 * con redirección (`signInWithOAuth`): obligaba a dar de alta el dominio de Supabase en Google, que lo enseñaba al elegir la cuenta.
 */
function SignInButton({ account }: { account: Account }) {
  const slot = useRef(null as HTMLDivElement | null)
  const [status, setStatus] = useState('idle' as 'idle' | 'busy' | 'failed' | 'unavailable')
  useEffect(() => {
    let active = true
    const onCredential = (credential: GoogleCredential) => {
      setStatus('busy')
      account.signIn(credential).catch(() => active && setStatus('failed'))
    }
    if (slot.current) renderGoogleButton(slot.current, onCredential).catch(() => active && setStatus('unavailable'))
    return () => {
      active = false
      releaseGoogleButton(onCredential)
    }
  }, [account])
  return (
    <>
      <div ref={slot} className="google-signin" hidden={status === 'busy' || status === 'unavailable'} />
      {status === 'busy' && <Loading label={text.signingIn} />}
      {status === 'failed' && <p className="settings-status" role="alert">{text.signInFailed}</p>}
      {status === 'unavailable' && <p className="settings-status" role="alert">{text.googleUnavailable}</p>}
    </>
  )
}

function Unavailable({ state }: { state: AccountState }) {
  return state.status === 'connecting' ? <Loading label={text.connecting} /> : <p className="settings-hint">{text.offline}</p>
}

/** Con sesión, con cuenta o sin ella: el nickname se puede cambiar en los dos casos (RF-95, RF-112). */
function Player({ account, state }: { account: Account; state: Extract<AccountState, { userId: string }> }) {
  const guest = state.status === 'guest'
  return (
    <>
      {state.nickname !== null && (
        <>
          <p className="settings-hint">{guest ? text.guestNickname : text.signedIn}</p>
          <NicknameForm key={state.nickname} account={account} nickname={state.nickname} />
          {guest && <p className="settings-hint">{text.guestNicknameHint}</p>}
        </>
      )}
      <div className="account-actions">
        {guest ? (
          <>
            <p className="settings-hint">{text.signInHint}</p>
            <SignInButton account={account} />
          </>
        ) : (
          <>
            <p className="settings-hint">{text.signOutHint}</p>
            <button type="button" className="btn btn-small" onClick={() => void account.signOut()}>{text.signOut}</button>
          </>
        )}
      </div>
    </>
  )
}

function NicknameForm({ account, nickname }: { account: Account; nickname: string }) {
  const [draft, setDraft] = useState(nickname)
  const [message, setMessage] = useState(null as { kind: 'ok' | 'error'; text: string } | null)
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!NICKNAME.test(draft)) return setMessage({ kind: 'error', text: text.nicknameErrors.invalid_nickname })
    setBusy(true)
    try {
      await account.setNickname(draft)
      setMessage({ kind: 'ok', text: text.nicknameSaved })
    } catch (error) {
      const code = error instanceof CloudError ? error.code : ''
      setMessage({ kind: 'error', text: text.nicknameErrors[code] ?? text.nicknameErrors.other })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form className="nickname-form" onSubmit={save}>
        <label htmlFor="nickname-input">{text.nicknameLabel}</label>
        <input
          id="nickname-input"
          className="text-input"
          value={draft}
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="nickname-hint"
          onChange={(event) => {
            setDraft(event.target.value)
            setMessage(null)
          }}
        />
        <button type="submit" className="btn btn-small" disabled={busy || draft === nickname}>{text.nicknameSave}</button>
      </form>
      <p id="nickname-hint" className="settings-hint">{text.nicknameHint}</p>
      {/* Solo con aviso: sin él no deja un hueco en blanco. */}
      {message && <p className="settings-status" role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </>
  )
}
