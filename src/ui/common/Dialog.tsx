import { useEffect, useRef, useId, type KeyboardEvent } from 'react'

type DialogProps = {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo modal de confirmación: foco dentro, Escape cancela y el foco vuelve a donde estaba al cerrarse. */
export function Dialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: DialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const cancelRef = useRef(null as HTMLButtonElement | null)
  const confirmRef = useRef(null as HTMLButtonElement | null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const first = cancelRef.current
    const last = confirmRef.current
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="dialog-backdrop" onKeyDown={handleKeyDown}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} className="dialog-panel">
        <h2 id={titleId} className="dialog-title">{title}</h2>
        <p id={bodyId} className="dialog-body">{body}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
