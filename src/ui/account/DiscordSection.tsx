import { useEffect, useState } from 'react'
import type { CloudApi, DiscordReminder } from '../../cloud/api'
import { deviceTimeZone, formatMinute, REMINDER_MINUTES, type DiscordLinkResult } from '../../cloud/discordLink'
import { esCloud } from '../../i18n/esCloud'
import { Loading } from '../common/Loading'

const text = esCloud.discord

type DiscordSectionProps = {
  api: CloudApi
  /** Resultado de la vinculación al volver de Discord (`?discord=`). */
  result?: DiscordLinkResult | null
  /** Ir a la Edge Function que lleva a Discord (en los tests, un espía). */
  navigate?: (url: string) => void
}

type Status = { kind: 'ok' | 'error'; text: string } | null

/**
 * «Aviso por Discord» en Cuenta, solo con cuenta (RF-115 a RF-119): conectar Discord (sale de la web y vuelve con `?discord=`), activar o
 * desactivar el aviso, su hora (de media en media hora, en la zona de este dispositivo) y desconectar.
 */
export function DiscordSection({ api, result = null, navigate = (url) => window.location.assign(url) }: DiscordSectionProps) {
  const [reminder, setReminder] = useState(undefined as DiscordReminder | null | 'unavailable' | undefined)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState((result ? { kind: result === 'ok' ? 'ok' : 'error', text: text.results[result] } : null) as Status)
  const zone = deviceTimeZone()

  useEffect(() => {
    let active = true
    api.discordReminder().then(
      (value) => active && setReminder(value),
      () => active && setReminder('unavailable'),
    )
    return () => {
      active = false
    }
  }, [api])

  async function connect() {
    setBusy(true)
    setStatus(null)
    try {
      navigate(await api.discordLinkUrl(zone))
    } catch {
      setBusy(false)
      setStatus({ kind: 'error', text: text.connectFailed })
    }
  }

  async function save(next: DiscordReminder) {
    setBusy(true)
    try {
      await api.setDiscordReminder(next.enabled, next.minute, zone)
      setReminder({ ...next, timeZone: zone })
      setStatus({ kind: 'ok', text: text.saved })
    } catch {
      setStatus({ kind: 'error', text: text.saveFailed })
    } finally {
      setBusy(false)
    }
  }

  async function unlink() {
    setBusy(true)
    try {
      await api.discordUnlink()
      setReminder(null)
      setStatus(null)
    } catch {
      setStatus({ kind: 'error', text: text.saveFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-section discord-section" aria-labelledby="discord-title">
      <h3 className="help-title" id="discord-title">{text.title}</h3>
      {reminder === undefined && <Loading label={text.loading} />}
      {reminder === 'unavailable' && <p className="settings-hint">{text.unavailable}</p>}
      {reminder === null && (
        <>
          <p className="settings-hint">{text.hint}</p>
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => void connect()}>{busy ? text.connecting : text.connect}</button>
        </>
      )}
      {reminder && reminder !== 'unavailable' && (
        <>
          <p className="settings-hint">{text.connectedAs(reminder.name)}</p>
          <div className="settings-music">
            <span id="discord-enabled">{text.enabledLabel}</span>
            <div className="settings-options" role="group" aria-labelledby="discord-enabled">
              {[true, false].map((on) => (
                <button key={String(on)} type="button" className="btn btn-small settings-option" aria-pressed={reminder.enabled === on} disabled={busy} onClick={() => void save({ ...reminder, enabled: on })}>
                  {on ? text.yes : text.no}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-music">
            <label htmlFor="discord-time">{text.timeLabel}</label>
            <select id="discord-time" className="text-input discord-time" value={reminder.minute} disabled={busy} onChange={(event) => void save({ ...reminder, minute: Number(event.currentTarget.value) })}>
              {REMINDER_MINUTES.map((minute) => (
                <option key={minute} value={minute}>{formatMinute(minute)}</option>
              ))}
            </select>
          </div>
          <p className="settings-hint">{reminder.timeZone === zone ? text.timeHint(zone) : text.otherZone(reminder.timeZone)}</p>
          {reminder.failed && <p className="settings-status" role="alert">{text.failed}</p>}
          <div className="account-actions">
            <button type="button" className="btn btn-small" disabled={busy} onClick={() => void unlink()}>{text.unlink}</button>
          </div>
        </>
      )}
      {status && <p className="settings-status" role={status.kind === 'error' ? 'alert' : 'status'}>{status.text}</p>}
    </section>
  )
}
