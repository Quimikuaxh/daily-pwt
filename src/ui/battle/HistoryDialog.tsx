import { useEffect, useId, useRef } from 'react'
import { es } from '../../i18n/es'

type HistoryDialogProps = { lines: string[]; onClose: () => void }

/** Historial completo del combate, a demanda (no es como el juego, que solo enseña el último mensaje). */
export function HistoryDialog({ lines, onClose }: HistoryDialogProps) {
  const titleId = useId()
  const closeRef = useRef(null as HTMLButtonElement | null)
  const logRef = useRef(null as HTMLDivElement | null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  useEffect(() => {
    const list = logRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [lines])

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="dialog-panel bt-history">
        <h2 id={titleId} className="dialog-title">{es.battle.historyTitle}</h2>
        <div ref={logRef} role="log" aria-label={es.battle.logLabel} className="bt-history-log" tabIndex={0}>
          {lines.length === 0 ? <p className="bt-line">{es.battle.historyEmpty}</p> : lines.map((line, index) => <p key={index} className="bt-line">{line}</p>)}
        </div>
        <div className="dialog-actions">
          <button ref={closeRef} type="button" className="btn btn-primary" onClick={onClose}>{es.battle.historyClose}</button>
        </div>
      </div>
    </div>
  )
}
