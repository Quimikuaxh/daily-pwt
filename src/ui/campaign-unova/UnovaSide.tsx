/**
 * Paneles laterales de la campaña de Teselia en escritorio (maqueta «escritorio-paneles-2», aprobada el 13/11/2026), con el estilo de los
 * menús de N2/B2: «Tu campaña» con sus datos en casillas y las medallas, y «Tu equipo» con las placas de la pantalla de equipo del diario,
 * el objeto de cada uno en su recuadro y la CAJA debajo. Mismas propiedades que los de Hoenn (CampaignSide.tsx); texto a 13 px, el único
 * tamaño nítido de la fuente (PRD §0, 14/11/2026).
 */
import { Fragment, useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { MemberIcon } from '../battle/party/MemberIcon'
import { hpBar } from '../battle/party/hpBar'
import { uiAsset } from '../common/uiAssets'
import { itemIconUrl } from '../common/spriteUrls'
import { usePreloadImages } from '../campaign/usePreloadImages'
import { CAMPAIGN_PANEL, PANEL_SCALE } from '../campaign/sidePanelsModel'
import type { CampaignCardProps, TeamPanelProps } from '../campaign/CampaignSide'
import { esCampaign } from '../../i18n/esCampaign'
import { n2b2Ui, unovaVars } from './unovaRoute'
import { UnovaTitle } from './UnovaTitle'
import '../battle/party/party.css'
import './unova.css'

const t = esCampaign.side
/** «Tu campaña» mide lo que la maqueta (184 x 236); «Tu equipo», lo que el panel de Hoenn (184 x 296). */
const CARD = { w: CAMPAIGN_PANEL.w, h: 236 }
const cardTheme = { ...n2b2Theme, screen: CARD, screens: 1 }
const teamTheme = { ...n2b2Theme, screen: CAMPAIGN_PANEL, screens: 1 }
const BOX_PER_ROW = 5
const BOX_ROWS = 2
/** Placa de la pantalla de equipo del diario (126 x 46) a la altura de una fila del panel; el objeto, a su tamaño (30 x 30). */
const PLATE = { w: 140, h: 28 }

/** «Tu campaña»: título, seis casillas con su dato y las ocho medallas. */
export function UnovaCampaignCard({ points, minutes, fainted, species, box, next, badges }: CampaignCardProps) {
  const rows: [string, string][] = [
    [t.points, esCampaign.result.points(points)], [t.time, esCampaign.result.clock(minutes)], [t.fainted, String(fainted)],
    [t.species, String(species)], [t.box, String(box)], [t.next, next],
  ]
  // Bloque con llaves: la guarda de literales (literals.test.ts) tomaba el código entre dos JSX por texto.
  const card = (() => { return (
    <div key="card" className="unova-screen" style={unovaVars()}>
      <span className="unova-panel" style={{ left: 4, top: 4, width: CARD.w - 8, height: CARD.h - 8 }} />
      <UnovaTitle x={7} y={8} width={170} title={t.campaignTitle} />
      {rows.map(([label, value], i) => (
        <Fragment key={label}>
          <span className="unova-bar-off" style={{ left: 7, top: 36 + i * 22, width: 170, height: 20 }} />
          <span className="unova-text unova-soft" style={{ left: 13, top: 39 + i * 22 }}>{label}</span>
          <span className="unova-text" style={{ right: 13, top: 39 + i * 22 }}>{value}</span>
        </Fragment>
      ))}
      <span className="unova-text unova-soft" style={{ left: 12, top: 172 }}>{t.medals}</span>
      <span className="unova-bar-off" style={{ left: 7, top: 188, width: 170, height: 34 }} />
      {Array.from({ length: 8 }, (_, i) => (
        <img key={i} src={n2b2Ui(`medalla-${i + 1}${i < badges ? '' : '-off'}`)} alt="" style={{ left: 16 + i * 20, top: 192 }} />
      ))}
    </div>
  ) })()
  return (
    <>
      {/* Lo pintado va en el lienzo; para los lectores de pantalla, la misma ficha en texto. */}
      <dl className="visually-hidden">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        <div><dt>{t.medals}</dt><dd>{t.badgesValue(badges)}</dd></div>
      </dl>
      <ConsoleStage theme={cardTheme} scale={PANEL_SCALE} screens={[card]} />
    </>
  )
}

/** «Tu equipo»: seis filas (las vacías, solo la casilla), el objeto de cada uno en su recuadro y la CAJA por páginas. */
export function UnovaTeamPanel({ party, box = [], limit = party.length, itemName }: TeamPanelProps) {
  const count = party.filter(Boolean).length
  const perPage = BOX_PER_ROW * BOX_ROWS
  const pages = Math.max(1, Math.ceil(box.length / perPage))
  usePreloadImages(party.flatMap((mon) => (mon?.item ? [itemIconUrl(mon.item)] : [])))
  const [boxPage, setBoxPage] = useState(0)
  const page = Math.min(boxPage, pages - 1)
  const shownBox = box.slice(page * perPage, (page + 1) * perPage)
  // Bloque con llaves: la guarda de literales (literals.test.ts) tomaba el código entre dos JSX por texto.
  const screen = (() => { return (
    <div key="team" className="unova-screen" style={unovaVars()}>
      <span className="unova-panel" style={{ left: 4, top: 4, width: CAMPAIGN_PANEL.w - 8, height: CAMPAIGN_PANEL.h - 8 }} />
      <UnovaTitle x={7} y={8} width={170} title={t.teamTitle}>
        <span className="unova-text" style={{ right: 13, top: 13 }}>{t.teamCount(count, limit)}</span>
      </UnovaTitle>
      {party.map((mon, i) => {
        const top = 34 + i * 30
        const bar = mon ? hpBar(mon, 48) : null
        if (!mon || !bar) {
          return <span key={i} className="unova-bar-off" style={{ left: 8, top: top + 1, width: PLATE.w, height: PLATE.h - 2 }} />
        }
        return (
          <Fragment key={i}>
            <span className="unova-plate" style={{ left: 8, top, backgroundImage: `url(${uiAsset(`party/panel-blue-left${i === 0 ? '-lit' : ''}.png`)})` }} />
            <span className="unova-plate-icon" style={{ left: 10, top: top + 3 }}><MemberIcon spriteId={mon.species} /></span>
            <span className="unova-text" style={{ left: 38, top: top + 3 }}>{mon.name}</span>
            <span className="unova-text" style={{ right: CAMPAIGN_PANEL.w - 144, top: top + 3 }}>{`Nv${mon.level}`}</span>
            <img src={uiAsset('party/hp-track.png')} alt="" style={{ left: 40, top: top + 18 }} />
            <span className="bt-party-fill" data-fill={bar.color} style={{ left: 54, top: top + 20, width: bar.width }} />
            <span className="unova-bar-off" style={{ left: 151, top: top + 1, width: 26, height: 26 }} />
            {mon.item && <img src={itemIconUrl(mon.item)} alt="" style={{ left: 149, top: top - 1 }} />}
          </Fragment>
        )
      })}
      <span className="unova-text unova-soft" style={{ left: 12, top: 218 }}>{t.box}</span>
      {pages > 1 && (
        <>
          <span className="unova-text" style={{ left: 126, top: 218, width: 32, textAlign: 'center' }}>{t.boxPage(page + 1, pages)}</span>
          {([[-1, '‹', 112], [1, '›', 160]] as const).map(([step, arrow, x]) => (
            <button key={arrow} type="button" className="unova-text unova-arrow" style={{ left: x, top: 214 }}
              aria-label={t.boxPageLabel(((page + step + pages) % pages) + 1, pages)} onClick={() => { setBoxPage((page + step + pages) % pages) }}>{arrow}</button>
          ))}
        </>
      )}
      <span className="unova-bar-off" style={{ left: 7, top: 232, width: 170, height: 58 }} />
      {shownBox.map((mon, i) => (
        <span key={i} className="unova-box-icon" style={{ left: 12 + (i % BOX_PER_ROW) * 33, top: 236 + Math.floor(i / BOX_PER_ROW) * 26 }}>
          <MemberIcon spriteId={mon.species} dimmed={mon.fainted} />
        </span>
      ))}
    </div>
  ) })()
  return (
    <>
      <ul className="visually-hidden">
        {party.flatMap((mon) => (mon ? [mon] : [])).map((mon, i) => <li key={i}>{t.teamMonLabel(mon.name, mon.level, mon.item ? itemName(mon.item) : null)}</li>)}
        {box.length > 0 && <li>{t.boxLabel(box.map((mon) => (mon.fainted ? t.faintedName(mon.name) : mon.name)).join(', '))}</li>}
      </ul>
      <ConsoleStage theme={teamTheme} scale={PANEL_SCALE} screens={[screen]} />
    </>
  )
}
