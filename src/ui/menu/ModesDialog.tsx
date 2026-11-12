import { useEffect } from 'react'
import { es } from '../../i18n/es'
import { Modal } from '../common/Modal'

/** `prefetch`: descarga el código del modo al abrir la ventana (entrar en él no espera a la descarga). */
type Mode = { id: string; label: string; hint: string; onOpen: () => void; prefetch?: () => void }

const base = import.meta.env.BASE_URL

/**
 * Miniatura de cada modo (Jose, 12/11/2026, opción A de `maquetas.html?v=modos-a`): el reto diario, con el escenario del PWT, Máximo,
 * Cintia y el VS; la Nuzlocke de Hoenn, con el mapa de Hoenn y los dos protagonistas (Bruno y Aura). Las campañas que vengan, con los
 * suyos. Sin miniatura propia, ninguna.
 */
function ModeArt({ id }: { id: string }) {
  if (id === 'daily') {
    return (
      <span className="modes-art modes-art-daily" aria-hidden="true">
        <img src={`${base}ui/battle/pwt-stage.png`} alt="" className="modes-art-bg" />
        <img src={`${base}sprites/trainers/maximo-vs.png`} alt="" className="modes-art-left" />
        <img src={`${base}sprites/trainers/cintia-vs.png`} alt="" className="modes-art-right" />
        <img src={`${base}ui/battle/vs-logo.png`} alt="" className="modes-art-vs" />
      </span>
    )
  }
  if (id === 'nuzlocke-hoenn') {
    return (
      <span className="modes-art" aria-hidden="true">
        <img src={`${base}ui/emerald/mapa-hoenn.png`} alt="" className="modes-art-bg" />
        <img src={`${base}ui/emerald/entrenador-brendan.png`} alt="" className="modes-art-left" />
        <img src={`${base}ui/emerald/entrenador-may.png`} alt="" className="modes-art-right" />
      </span>
    )
  }
  return null
}

/**
 * Modos de juego (Jose, 11/11/2026): el reto diario, que es donde se está, y los demás modos (de momento, la campaña Nuzlocke de Hoenn).
 * Cada modo es un botón con su miniatura y su descripción, uno debajo de otro; el actual va en rojo, como los botones principales
 * (12/11/2026: en vez de
 * «Estás aquí»), y lo dice `aria-current`.
 */
export function ModesDialog({ modes, onClose }: { modes: readonly Mode[]; onClose: () => void }) {
  // Al abrir Modos ya se descarga la campaña: al elegirla salía medio segundo en blanco esperando su código (Jose, 12/11/2026).
  useEffect(() => { modes.forEach((mode) => mode.prefetch?.()) }, [modes])
  const text = es.modes
  const option = (id: string, label: string, hint: string, current: boolean, onClick: () => void) => {
    return (
      <li key={id}>
        <button type="button" className="btn modes-option" aria-current={current ? 'page' : undefined} aria-describedby={`mode-${id}-hint`} onClick={onClick}>
          <ModeArt id={id} />
          <span className="modes-text">
            <span className="modes-label">{label}</span>
            <span id={`mode-${id}-hint`} className="settings-hint modes-hint">{hint}</span>
          </span>
        </button>
      </li>
    )
  }
  return (
    <Modal title={text.title} onClose={onClose} className="modes-dialog">
      <ul className="modes-list">
        {option('daily', text.daily, text.dailyHint, true, onClose)}
        {modes.map((mode) => option(mode.id, mode.label, mode.hint, false, () => { onClose(); mode.onOpen() }))}
      </ul>
    </Modal>
  )
}
