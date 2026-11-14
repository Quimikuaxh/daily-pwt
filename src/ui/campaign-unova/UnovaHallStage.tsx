/**
 * Pantalla de arriba del Salón de la Fama de Teselia (PRD §0, 14/11/2026), la misma en el Salón y en la imagen para compartir: fondo oscuro
 * con la Poké Ball gris grande, destellos, la banda, el protagonista con los seis (unovaHall) y la barra de abajo. Todo en imágenes y canvas
 * para que `exportScreens` lo copie (los destellos, animados, no salen en la imagen).
 */
import { useEffect, useRef } from 'react'
import { uiAsset } from '../common/uiAssets'
import { speciesSprite } from '../common/spriteUrls'
import type { GameData } from '../../core/types'
import type { Protagonist } from '../campaign/resultModel'
import { PixelText } from './PixelText'
import { HALL_BALL, HALL_BAND_TOP, HALL_BAR_TOP, HALL_COLORS, HALL_PROTAGONIST, ballColor, unovaHallOrder, unovaHallSpots } from './unovaHall'

/** Destellos alrededor de la Poké Ball (x, y). */
const SPARKLES: readonly [number, number][] = [[24, 40], [230, 34], [36, 140], [222, 132], [70, 30], [186, 26]]

function HallBackdrop() {
  const canvas = useRef(null as HTMLCanvasElement | null)
  useEffect(() => {
    const g = canvas.current?.getContext('2d')
    if (!g) return
    g.fillStyle = HALL_COLORS.bg
    g.fillRect(0, 0, 256, 192)
    for (let y = HALL_BALL.cy - HALL_BALL.r; y < HALL_BALL.cy + HALL_BALL.r; y += 1) {
      for (let x = HALL_BALL.cx - HALL_BALL.r; x < HALL_BALL.cx + HALL_BALL.r; x += 1) {
        const color = ballColor(x, y)
        if (!color) continue
        g.fillStyle = color
        g.fillRect(x, y, 1, 1)
      }
    }
    g.fillStyle = HALL_COLORS.bandEdge
    g.fillRect(0, HALL_BAND_TOP, 256, 20)
    g.fillStyle = HALL_COLORS.band
    g.fillRect(0, HALL_BAND_TOP + 1, 256, 18)
    g.fillStyle = HALL_COLORS.barEdge
    g.fillRect(0, HALL_BAR_TOP - 1, 256, 1)
    g.fillStyle = HALL_COLORS.bar
    g.fillRect(0, HALL_BAR_TOP, 256, 20)
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
  const mon = (i: number) => { return (
    <img key={i} className={fallen ? 'unova-hall-mon unova-hall-fallen' : 'unova-hall-mon'} src={speciesSprite(data.dex, shown[i].species, 'front') ?? ''}
      alt="" style={{ left: spots[i].x - 48, top: spots[i].y - 48 }} />
  ) }
  return (
    <div className="unova-hall">
      <HallBackdrop />
      {SPARKLES.map(([x, y], i) => <span key={i} className="unova-hall-sparkle" style={{ left: x, top: y, animationDelay: `${i * 0.35}s` }} aria-hidden="true" />)}
      <PixelText text={band} left={0} top={HALL_BAND_TOP + 3} width={256} align="center" shadow="#101850" />
      {order.filter((i) => { return !spots[i].front }).map(mon)}
      <img className="unova-hall-protagonist" src={uiAsset(`trainers/${who}-front.png`)} alt="" style={HALL_PROTAGONIST} />
      {order.filter((i) => { return spots[i].front }).map(mon)}
      <PixelText text={bar[0]} left={8} top={HALL_BAR_TOP + 3} />
      <PixelText text={bar[1]} left={0} top={HALL_BAR_TOP + 3} width={256} align="center" />
      <PixelText text={bar[2]} left={168} top={HALL_BAR_TOP + 3} width={80} align="right" />
    </div>
  )
}
