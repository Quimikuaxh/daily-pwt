import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { es } from '../../i18n/es'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Ventana modal con contenido libre (Estadísticas, Ayuda, Ajustes): foco dentro, Escape o «Cerrar» la cierran y el foco vuelve a donde estaba. */
export function Modal({ title, onClose, children, className }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef(null as HTMLDivElement | null)
  const closeRef = useRef(null as HTMLButtonElement | null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="dialog-backdrop" onKeyDown={handleKeyDown} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`dialog-panel modal-panel ${className ?? ''}`}>
        <div className="modal-head">
          <h2 id={titleId} className="dialog-title">{title}</h2>
          <button ref={closeRef} type="button" className="btn btn-small modal-close" onClick={onClose}>{es.stats.close}</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
