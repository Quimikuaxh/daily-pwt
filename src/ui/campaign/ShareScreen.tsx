/**
 * Pantalla final de la campaña para compartir (Jose, 12/11/2026, opción A de `maquetas.html?v=compartir-a`): arriba, el Salón de la
 * Fama con los que ganaron la Liga (o, si se perdió, los del último combate y ante quién); abajo, la Ficha de Entrenador con
 * POKéDEX, BAJAS, TIEMPO y las medallas. Suena la música de los créditos. «Compartir» abre el menú del sistema con la imagen de las
 * dos pantallas (720 × 960) y «Guardar imagen» la descarga (`exportScreens`).
 */
import { useRef, useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { exportScreens, shareOrDownload } from '../console/exportScreens'
import { esCampaign } from '../../i18n/esCampaign'
import { hallOfFameOrder, hallOfFameSpots, type Protagonist } from './resultModel'
import { CREDITS_MUSIC, useCampaignMusic } from './campaignMusic'

const t = esCampaign.share
const r = esCampaign.result
/** Aumentos de la imagen: 240 × 320 → 720 × 960. */
const ZOOM = 3

type ShareScreenProps = {
  won: boolean
  player: string
  protagonist: Protagonist
  rival: string
  /** Los que salen arriba: los que ganaron la Liga o los del último combate. */
  team: readonly { species: string; name: string }[]
  card: { id: string; pokedex: number; fainted: number; minutes: number; badges: number }
  /** Fecha para el nombre del fichero (AAAA-MM-DD). */
  date: string
  reservedHeight?: number
  scale?: number
}

export function ShareScreen({ won, player, protagonist, rival, team, card, date, reservedHeight, scale }: ShareScreenProps) {
  useCampaignMusic(CREDITS_MUSIC)
  const stage = useRef(null as HTMLDivElement | null)
  const [status, setStatus] = useState(null as string | null)
  const title = won ? t.champion(player, protagonist === 'may') : t.fell(player, rival)
  const shown = team.slice(0, 6)
  const spots = hallOfFameSpots(shown.length)
  const stats: [string, string, number][] = [[r.pokedex, String(card.pokedex), 65], [t.fainted, String(card.fainted), 81], [r.time, r.clock(card.minutes), 97]]
  const cardText = t.cardText(player, card.id, card.pokedex, card.fainted, r.clock(card.minutes), card.badges)

  const send = async (download: boolean) => {
    const element = stage.current?.querySelector('.console-stage') as HTMLElement | null
    if (!element) return
    try {
      const result = await shareOrDownload(exportScreens(element, ZOOM), t.fileName(date), t.text(player, won, rival), download)
      setStatus(result === 'downloaded' ? t.saved : null)
    } catch {
      setStatus(t.failed)
    }
  }

  return (
    <div className="share-screen" ref={stage}>
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="hall" className="share-top" role="img" aria-label={`${title} ${r.champions(shown.map((member) => member.name).join(', '))}`}>
          <img src={emeraldTheme.asset('resultado-salon')} alt="" style={{ left: 0, top: 0 }} />
          {/* De arriba abajo: la fila de abajo queda delante (hallOfFameOrder). */}
          {hallOfFameOrder(shown.length).map((i) => {
            const member = shown[i]
            const [x, y] = spots[i]
            return <img key={`${member.species}-${i}`} className="mon-front" src={emeraldSprite('front', member.species)} alt="" style={{ left: x - 32, top: y - 32 }} />
          })}
          <GameText text={title} x={16} y={121} width={208} align="center" color="salon" hidden />
        </div>
      ), (
        <div key="card" className="share-card" role="img" aria-label={cardText}>
          <img src={emeraldTheme.asset('resultado-tarjeta')} alt="" style={{ left: 0, top: 0 }} />
          <GameText text={r.name(player)} x={24} y={41} hidden />
          <GameText text={r.id(card.id)} x={128} y={17} width={96} align="center" hidden />
          {stats.map(([label, value, y]) => (
            <span key={label}>
              <GameText text={label} x={24} y={y} hidden />
              <GameText text={value} x={24} y={y} width={112} align="right" hidden />
            </span>
          ))}
          <img src={emeraldTheme.asset(`entrenador-${protagonist}`)} alt="" style={{ left: 153, top: 40 }} />
          {Array.from({ length: card.badges }, (_, i) => (
            <img key={i} src={emeraldTheme.asset(`medalla-${i + 1}`)} alt="" style={{ left: 32 + 24 * i, top: 120 }} />
          ))}
        </div>
      )]} />
      <div className="share-actions">
        <button type="button" className="campaign-action" aria-label={t.shareLabel} onClick={() => { void send(false) }}>{t.share}</button>
        <button type="button" className="campaign-action" aria-label={t.saveLabel} onClick={() => { void send(true) }}>{t.save}</button>
      </div>
      <p className="sr-only" role="status">{status ?? ''}</p>
    </div>
  )
}
