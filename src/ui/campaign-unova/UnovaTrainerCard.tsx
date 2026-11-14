/**
 * Ficha de Entrenador de Teselia (pieza `ficha` de la ROM): «FICHA DE ENTRENADOR» sobre el rótulo inglés, nombre, ID, tres filas de datos y
 * el protagonista; con `badges`, las medallas en ocho huecos iguales a lo ancho de la franja de abajo, cada una centrada en el suyo (PRD §0,
 * «Locke de N2/B2: compartir»). La usan el Resultado y la imagen para compartir; todo en imágenes y canvas (`exportScreens`).
 */
import { uiAsset } from '../common/uiAssets'
import { esUnova } from '../../i18n/esUnova'
import type { Protagonist } from '../campaign/resultModel'
import { n2b2Ui } from './unovaRoute'
import { CanvasFill, PixelText } from './PixelText'

const u = esUnova
/** Pieza de la ficha en la pantalla y su franja de abajo (x de inicio y ancho; y de la medalla). */
const CARD = { left: 6, top: 13 }
/** Renglones de la pieza (marcados por sus puntos de la izquierda): el nombre en el primero, el ID y la primera fila en las dos franjas claras (y 60 y 76) y el resto debajo, cada 16 px, antes de la franja de abajo (y 132). */
const LINES = { name: 41, id: 61, rows: 77 }
const STRIP = { left: CARD.left + 15, width: 218, top: CARD.top + 121 }

/** Centro (x) de cada uno de los ocho huecos iguales de la franja; la medalla se centra en él (`.unova-result-badge`). */
export const badgeSlots = (): number[] => Array.from({ length: 8 }, (_, i) => Math.round(STRIP.left + (STRIP.width * (i + 0.5)) / 8))

type TrainerCardProps = {
  player: string
  id: string
  rows: readonly (readonly [string, string])[]
  protagonist: Protagonist
  badges?: number
}

export function UnovaTrainerCard({ player, id, rows, protagonist, badges }: TrainerCardProps) {
  const who = protagonist === 'may' ? 'rosa' : 'nate'
  return (
    <>
      <CanvasFill color="#1e3c8c" />
      <img src={n2b2Ui('ficha')} alt="" style={CARD} />
      <PixelText text={u.cardTitle} left={CARD.left + 20} top={CARD.top + 5} width={124} align="center" shadow="#182c78" />
      <PixelText text={u.cardName(player)} left={18} top={LINES.name} />
      <PixelText text={u.cardId(id)} left={18} top={LINES.id} />
      {rows.map(([label, value], i) => (
        <span key={label}>
          <PixelText text={label} left={18} top={LINES.rows + i * 16} color="#d0d8f8" />
          <PixelText text={value} left={18} top={LINES.rows + i * 16} width={134} align="right" />
        </span>
      ))}
      <img className="unova-result-protagonist" src={uiAsset(`trainers/${who}-front.png`)} alt="" style={{ left: 160, top: 20 }} />
      {badges !== undefined && badgeSlots().slice(0, badges).map((x, i) => (
        <img key={i} className="unova-result-badge" src={n2b2Ui(`medalla-${i + 1}`)} alt="" style={{ left: x, top: STRIP.top }} />
      ))}
    </>
  )
}
