import { useState } from 'react'
import type { WelcomeNeeds } from '../../cloud/state'
import { esCloud } from '../../i18n/esCloud'
import { Modal } from '../common/Modal'
import '../stats/cloud.css'

const text = esCloud.welcome

type WelcomePromptProps = {
  needs: WelcomeNeeds
  nickname: string | null
  /** Abre Cuenta (cambiar el nombre e iniciar sesión). */
  onOpenAccount: () => void
  /** Al cerrar, con la casilla «No volver a mostrar» marcada o no. */
  onClose: (never: boolean) => void
}

/**
 * Aviso de Hoy (RF-94b; Jose, 31/10/2026): explica que se puede elegir nombre y, sin cuenta, que con ella se guardan estadísticas y racha.
 * Solo enlaza a Cuenta, donde están las dos cosas. *Descartado:* el campo del nombre y el botón de Google dentro del aviso.
 */
export function WelcomePrompt({ needs, nickname, onOpenAccount, onClose }: WelcomePromptProps) {
  const [never, setNever] = useState(false)
  return (
    <Modal title={text.title} onClose={() => onClose(never)} className="welcome-dialog">
      {needs.name && nickname && <p>{text.name(nickname)}</p>}
      {needs.account && <p>{text.account}</p>}
      <label className="welcome-never">
        <input type="checkbox" checked={never} onChange={(event) => setNever(event.target.checked)} /> {text.never}
      </label>
      <div className="account-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            onClose(never)
            onOpenAccount()
          }}
        >
          {text.open}
        </button>
        <button type="button" className="btn btn-small" onClick={() => onClose(never)}>
          {text.later}
        </button>
      </div>
    </Modal>
  )
}
