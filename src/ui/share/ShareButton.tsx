import { useState } from 'react'
import { es } from '../../i18n/es'
import { shareResult, type ShareOutcome } from './shareText'

const MESSAGES: Partial<Record<ShareOutcome, string>> = { copied: es.share.copied, failed: es.share.failed }

/** «Compartir»: panel del sistema en móvil o copia al portapapeles. Si no se puede copiar, deja el texto a la vista para copiarlo a mano. */
export function ShareButton({ text }: { text: string }) {
  const [outcome, setOutcome] = useState(null as ShareOutcome | null)
  const message = outcome ? MESSAGES[outcome] : undefined

  return (
    <div className="share">
      <button type="button" className="btn btn-primary share-button" onClick={() => void shareResult(text).then(setOutcome)}>
        {es.share.button}
      </button>
      <p className="share-status" role="status">{message}</p>
      {outcome === 'failed' && <pre className="share-text" data-testid="share-text">{text}</pre>}
    </div>
  )
}
