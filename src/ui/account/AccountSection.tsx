import { useState, type FormEvent } from 'react'
import { CloudError } from '../../cloud/api'
import type { Account } from '../../cloud/account'
import type { AccountState } from '../../cloud/state'
import { es } from '../../i18n/es'
import { esCloud } from '../../i18n/esCloud'
import '../stats/cloud.css'

const text = esCloud.account
const NICKNAME = /^[A-Za-z0-9_]{3,16}$/

/** Cuenta en Ajustes (RF-93 a RF-96): iniciar sesión con Google, cambiar el nickname y cerrar sesión. */
export function AccountSection({ account, state }: { account: Account; state: AccountState }) {
  return (
    <section className="settings-section account-section">
      <h3 className="help-title">{text.title}</h3>
      {state.status === 'signedIn' || state.status === 'guest' ? <Player account={account} state={state} /> : <Unavailable state={state} />}
    </section>
  )
}

/** Botón «Iniciar sesión con Google»: lleva a Google y vuelve a la página. */
function SignInButton({ account }: { account: Account }) {
  const [status, setStatus] = useState('idle' as 'idle' | 'busy' | 'failed')
  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        disabled={status === 'busy'}
        onClick={() => {
          setStatus('busy')
          account.signIn().catch(() => setStatus('failed'))
        }}
      >
        {status === 'busy' ? es.account.signingIn : es.account.signIn}
      </button>
      {status === 'failed' && <p className="settings-status" role="alert">{text.signInFailed}</p>}
    </>
  )
}

function Unavailable({ state }: { state: AccountState }) {
  return <p className="settings-hint">{state.status === 'connecting' ? text.connecting : text.offline}</p>
}

/** Con sesión, con cuenta o sin ella: el nickname se puede cambiar en los dos casos (RF-95, RF-112). */
function Player({ account, state }: { account: Account; state: Extract<AccountState, { userId: string }> }) {
  const guest = state.status === 'guest'
  return (
    <>
      {state.nickname !== null && (
        <>
          <p className="settings-hint">{guest ? text.guestNickname(state.nickname) : text.signedInAs(state.nickname)}</p>
          <NicknameForm key={state.nickname} account={account} nickname={state.nickname} />
          {guest && <p className="settings-hint">{text.guestNicknameHint}</p>}
        </>
      )}
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
      <p className="settings-status" role={message?.kind === 'error' ? 'alert' : 'status'}>{message?.text ?? ''}</p>
    </>
  )
}
