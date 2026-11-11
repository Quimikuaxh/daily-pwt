import { es } from '../../i18n/es'
import { Modal } from '../common/Modal'

type Mode = { id: string; label: string; hint: string; onOpen: () => void }

/**
 * Modos de juego (Jose, 11/11/2026): el reto diario, que es donde se está, y los demás modos (de momento, la campaña Nuzlocke de Hoenn).
 * Cada modo es un botón con su descripción; habrá más en el futuro.
 */
export function ModesDialog({ modes, onClose }: { modes: readonly Mode[]; onClose: () => void }) {
  const text = es.modes
  return (
    <Modal title={text.title} onClose={onClose} className="modes-dialog">
      <ul className="modes-list">
        <li>
          <button type="button" className="btn modes-option" aria-current="page" aria-describedby="mode-daily-hint" onClick={onClose}>
            {text.daily} <span className="modes-current">{text.current}</span>
          </button>
          <p id="mode-daily-hint" className="settings-hint">{text.dailyHint}</p>
        </li>
        {modes.map((mode) => (
          <li key={mode.id}>
            <button type="button" className="btn modes-option" aria-describedby={`mode-${mode.id}-hint`} onClick={() => { onClose(); mode.onOpen() }}>
              {mode.label}
            </button>
            <p id={`mode-${mode.id}-hint`} className="settings-hint">{mode.hint}</p>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
