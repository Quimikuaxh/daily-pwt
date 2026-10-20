import type { CSSProperties } from 'react'
import iconIndex from '../../../generated/icon-index.json'
import { uiAsset } from '../../common/uiAssets'

const ICON_COLUMNS = 12
export const ICON_WIDTH = 40
export const ICON_HEIGHT = 30

/** Icono de menú del Pokémon: recorte de la hoja de iconos de Showdown (las hojas de The Spriters Resource solo cubren Teselia). */
export function MemberIcon({ spriteId, dimmed = false }: { spriteId: string; dimmed?: boolean }) {
  const position = (iconIndex as Record<string, number>)[spriteId] ?? 0
  const style: CSSProperties = {
    width: ICON_WIDTH,
    height: ICON_HEIGHT,
    backgroundImage: `url(${uiAsset('party/icons-sheet.png')})`,
    backgroundPosition: `-${(position % ICON_COLUMNS) * ICON_WIDTH}px -${Math.floor(position / ICON_COLUMNS) * ICON_HEIGHT}px`,
  }
  return <span className="bt-member-icon" data-dimmed={dimmed ? 'true' : undefined} style={style} aria-hidden="true" />
}
