type MessageBoxProps = {
  text: string | null
  onAdvance: () => void
}

/**
 * Caja de mensajes del juego: un mensaje cada vez, que avanza solo; un toque lo adelanta (el teclado lo recoge BattleScreen).
 * El texto actual es una región `status` (aria-live): el historial completo está aparte, en el panel Registro.
 */
export function MessageBox({ text, onAdvance }: MessageBoxProps) {
  return (
    <div className="bt-message" onClick={onAdvance}>
      <p className="bt-message-text" role="status" aria-live="polite" aria-atomic="true">
        {text}
      </p>
    </div>
  )
}
