import { lazy, Suspense, useState } from 'react'
import type { Account } from '../../cloud/account'
import type { AccountState } from '../../cloud/state'
import { es } from '../../i18n/es'
import { ANIMATION_MODES, SPEEDS, type Settings } from '../../storage/settings'
import { Dialog } from '../common/Dialog'
import { Modal } from '../common/Modal'
import { SoundSettings } from './SoundSettings'

const text = es.settings
// Fuera de la ruta crítica (E2E-21).
const AccountSection = lazy(() => import('../account/AccountSection').then((module) => ({ default: module.AccountSection })))

type SettingsDialogProps = {
  settings: Settings
  onChange: (settings: Settings) => void
  /** Borra el historial y los ajustes de este navegador. */
  onClearData: () => void
  onClose: () => void
  account?: Account
  accountState?: AccountState
}

/** Ajustes (PRD §10.6, decisiones del 22 y 23/10/2026): velocidad del combate, animaciones de movimientos, sonido y volumen, y «Borrar datos locales»; sin tema claro/oscuro. */
export function SettingsDialog({ settings, onChange, onClearData, onClose, account, accountState }: SettingsDialogProps) {
  const [confirming, setConfirming] = useState(false)
  const [cleared, setCleared] = useState(false)

  return (
    <>
      <Modal title={text.title} onClose={onClose} className="settings-dialog">
        {account && accountState && accountState.status !== 'disabled' && (
          <Suspense fallback={null}>
            <AccountSection account={account} state={accountState} />
          </Suspense>
        )}
        <section className="settings-section">
          <h3 className="help-title" id="settings-speed">{text.speedTitle}</h3>
          <div className="settings-options" role="group" aria-labelledby="settings-speed">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className="btn btn-small settings-option"
                aria-pressed={settings.speed === speed}
                onClick={() => onChange({ ...settings, speed })}
              >
                {text.speedOption(speed)}
              </button>
            ))}
          </div>
          <p className="settings-hint">{text.speedHint}</p>
        </section>
        <section className="settings-section">
          <h3 className="help-title" id="settings-animations">{text.animationsTitle}</h3>
          <div className="settings-options" role="group" aria-labelledby="settings-animations">
            {ANIMATION_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className="btn btn-small settings-option"
                aria-pressed={settings.animations === mode}
                onClick={() => onChange({ ...settings, animations: mode })}
              >
                {text.animationModes[mode]}
              </button>
            ))}
          </div>
          <p className="settings-hint">{text.animationsHint}</p>
        </section>
        <SoundSettings settings={settings} onChange={(sound) => onChange({ ...settings, ...sound })} />
        <section className="settings-section">
          <h3 className="help-title">{text.dataTitle}</h3>
          <p className="settings-hint">{text.dataHint}</p>
          <button type="button" className="btn btn-danger btn-small" onClick={() => setConfirming(true)}>{text.clear}</button>
          <p className="settings-status" role="status">{cleared ? text.cleared : ''}</p>
        </section>
      </Modal>
      {confirming && (
        <Dialog
          title={text.confirmTitle}
          body={text.confirmBody}
          confirmLabel={text.confirm}
          cancelLabel={text.cancel}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onClearData()
            setConfirming(false)
            setCleared(true)
          }}
        />
      )}
    </>
  )
}
