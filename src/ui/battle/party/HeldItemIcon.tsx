import { uiAsset } from '../../common/uiAssets'
import { PANEL } from './layout'

/**
 * Icono de objeto equipado sobre la esquina de abajo a la derecha del icono del Pokémon, como en la pantalla de equipo de N2/B2
 * (Jose, 17/11/2026: en el daily, la Torre y los lockes). Decorativo: el objeto se lee en Datos.
 */
export function HeldItemIcon({ item, inIcon = false }: { item: string | null | undefined; inIcon?: boolean }) {
  if (!item) return null
  // `inIcon`: dentro de la casilla recortada del icono (PC de Teselia), donde lo coloca su CSS; si no, en la placa, junto al icono.
  const style = inIcon ? undefined : { left: PANEL.icon.x + HELD_OFFSET.x, top: PANEL.icon.y + HELD_OFFSET.y }
  return <img className="bt-party-held" data-in-icon={inIcon || undefined} style={style} src={uiAsset('party/held-item.png')} alt="" width={6} height={8} />
}

/** Respecto al icono de 40 x 30: pegado a su borde de abajo y dentro de la silueta, donde el juego lo pinta. */
export const HELD_OFFSET = { x: 28, y: 21 } as const
