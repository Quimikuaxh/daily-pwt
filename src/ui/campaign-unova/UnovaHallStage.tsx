/**
 * Pantalla de arriba del Salón de la Fama de Teselia (maquetas aprobadas `salon-fama.png` y `compartir-gana.png`, 14/11/2026), la misma
 * en el Salón y en la imagen para compartir: la Poké Ball gris, la banda blanca, el protagonista con los seis (unovaHall) y la barra de
 * abajo. Todo en imágenes y canvas para que `exportScreens` lo copie (los destellos, animados, no salen en la imagen).
 */
import { useEffect, useRef } from 'react'
import { uiAsset } from '../common/uiAssets'
import { speciesSprite } from '../common/spriteUrls'
import type { GameData } from '../../core/types'
import type { Protagonist } from '../campaign/resultModel'
import { PixelText } from './PixelText'
import { HALL_BAND, HALL_BAR, HALL_COLORS, HALL_PROTAGONIST, HALL_SPARKLES, hallColor, unovaHallOrder, unovaHallSpots } from './unovaHall'

function HallBackdrop() {
  const canvas = useRef(null as HTMLCanvasElement | null)
  useEffect(() => {
    const g = canvas.current?.getContext('2d')
    if (!g) return
    const image = g.createImageData(256, 192)
    for (let y = 0; y < 192; y += 1) {
      for (let x = 0; x < 256; x += 1) {
        const hex = hallColor(x, y)
        const i = (y * 256 + x) * 4
        image.data[i] = parseInt(hex.slice(1, 3), 16)
        image.data[i + 1] = parseInt(hex.slice(3, 5), 16)
        image.data[i + 2] = parseInt(hex.slice(5, 7), 16)
        image.data[i + 3] = 255
      }
    }
    g.putImageData(image, 0, 0)
  }, [])
  return <canvas ref={canvas} className="unova-hall-backdrop" width={256} height={192} aria-hidden="true" />
}

type HallStageProps = {
  data: GameData
  /** Los que salen (hasta seis), en orden. */
  members: readonly { species: string }[]
  /** Los del último combate al perder: en gris. */
  fallen?: boolean
  protagonist: Protagonist
  band: string
  /** Los tres textos de la barra: izquierda, centro y derecha. */
  bar: readonly [string, string, string]
}

export function UnovaHallStage({ data, members, fallen = false, protagonist, band, bar }: HallStageProps) {
  const shown = members.slice(0, 6)
  const spots = unovaHallSpots(shown.length)
  const order = unovaHallOrder(shown.length)
  const who = protagonist === 'may' ? 'rosa' : 'nate'
  const mon = (i: number) => {
    return (
      <img key={i} className={fallen ? 'unova-hall-mon unova-hall-fallen' : 'unova-hall-mon'} src={speciesSprite(data.dex, shown[i].species, 'front') ?? ''}
        alt="" data-export-scale="" style={{ left: spots[i].x, top: spots[i].y, maxWidth: spots[i].size, maxHeight: spots[i].size }} />
    )
  }
  return (
    <div className="unova-hall">
      <HallBackdrop />
      {HALL_SPARKLES.map(([x, y], i) => <span key={i} className="unova-hall-sparkle" style={{ left: x - 1, top: y - 1, animationDelay: `${i * 0.35}s` }} aria-hidden="true" />)}
      <PixelText text={band} left={0} top={HALL_BAND.top + 2} width={256} align="center" color={HALL_COLORS.bandText} shadow={null} />
      {order.filter((i) => { return !spots[i].front }).map(mon)}
      <img className="unova-hall-protagonist" src={uiAsset(`trainers/${who}-front.png`)} alt="" data-export-scale=""
        style={{ left: HALL_PROTAGONIST.left, top: HALL_PROTAGONIST.top, width: HALL_PROTAGONIST.size, height: HALL_PROTAGONIST.size }} />
      {order.filter((i) => { return spots[i].front }).map(mon)}
      <PixelText text={bar[0]} left={8} top={HALL_BAR.top + 5} />
      <PixelText text={bar[1]} left={0} top={HALL_BAR.top + 5} width={256} align="center" />
      <PixelText text={bar[2]} left={168} top={HALL_BAR.top + 5} width={80} align="right" />
    </div>
  )
}
