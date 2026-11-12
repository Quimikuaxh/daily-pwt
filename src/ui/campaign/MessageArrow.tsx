/**
 * Flecha ▼ de «toca para seguir» al final de un mensaje (Jose, 12/11/2026: en el Resultado no se sabía que había que tocar). Es la del
 * juego (fonts/down_arrow.png, TextPrinterDrawDownArrow): 8 × 16 al final del texto, bajando 0, 1, 2 y 1 px cada 8 fotogramas.
 */
import { emeraldTheme } from '../console/themes/emerald'

export function MessageArrow({ x, y }: { x: number; y: number }) {
  return (
    <div className="message-arrow" style={{ left: x, top: y, width: 8, height: 18 }} aria-hidden="true">
      <img src={emeraldTheme.asset('flecha-mensaje')} alt="" style={{ left: 0, top: 0 }} />
    </div>
  )
}
