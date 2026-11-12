/**
 * POTENCIA y PRECISIÓN en la caja EFECTO de la página de movimientos (Draft y Movimientos): las cifras alineadas a la derecha en un hueco
 * del ancho de «100», y ese hueco centrado en la celda blanca del fondo (x 58 a 80 de `datos-movimientos`). Así 100 queda centrado y 20 o
 * 95 no se corren a la izquierda (Jose, 12/11/2026).
 */
import { GameText } from '../console/GameText'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { esCampaign } from '../../i18n/esCampaign'

const font = emeraldTheme.font as BitmapFont
const CELL = { x: 58, w: 22 }

export function SummaryValue({ value, y }: { value: number | null | undefined; y: number }) {
  const slot = textWidth(font, '100')
  const x = CELL.x + Math.floor((CELL.w - slot) / 2)
  return <GameText text={value ? String(value) : esCampaign.moves.none} x={x} y={y} width={slot} align="right" color="datos" hidden />
}
