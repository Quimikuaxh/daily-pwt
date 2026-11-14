/**
 * Draft de la campaña de Teselia (maqueta aprobada el 14/11/2026). Arriba, la pantalla de datos del diario tal cual (su pantalla de
 * arriba, abierta en estadísticas y habilidad como en la maqueta; sus flechas pasan a información y movimientos) con el candidato señalado; abajo, en el estilo de los menús
 * de N2/B2, los cuatro candidatos (icono, nombre, tipos y suma de estadísticas base; el señalado con la barra de borde cian), el rival del
 * tramo y los botones RECLUTAR y TU EQUIPO. Los candidatos van en filas a lo ancho y no en 2 x 2 para que nombre, tipos y suma quepan a
 * 13 px, el único tamaño nítido de la fuente.
 */
import { useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { MemberIcon } from '../battle/party/MemberIcon'
import SummaryScreen from '../battle/party/SummaryScreen'
import { TypeBadge } from '../common/TypeBadge'
import { shortTypeLabel } from '../common/typeLabels'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import type { DraftScreenProps } from '../campaign/campaignKit'
import { unovaVars } from './unovaRoute'
import { unovaSummaryMember } from './unovaSummary'
import { UnovaTitle } from './UnovaTitle'
import '../battle/party/party.css'
import '../battle/party/summary.css'
import './unova.css'

const t = esUnova
const draft = esCampaign.draft
const ROW = { x: 12, y: 36, w: 232, h: 24, step: 26 }


export function UnovaDraftScreen({ candidates, pick, picks, level, rivalName, onRecruit, onShowTeam, data, definition, scale, reservedHeight }: DraftScreenProps) {
  const [cursor, setCursor] = useState(0)
  const index = Math.min(cursor, candidates.length - 1)
  const mon = candidates[index]
  const member = unovaSummaryMember({ species: mon.id, level, history: mon.history }, definition, data)
  const recruit = () => { setCursor(0); onRecruit(mon.id) }
  return (
    <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} freeScreens={[0]} screens={[(
      // La pantalla de datos mide las dos pantallas: aquí se ve la de arriba y la sección recorta el resto.
      <div key="summary" className="unova-draft-summary">
        {member && <SummaryScreen key={mon.id} members={[member]} initialSlot={1} initialPage={1} data={data} onClose={() => undefined} />}
      </div>
    ), (
      <div key="offer" className="unova-screen" style={unovaVars()} role="group" aria-label={draft.pick(pick + 1, picks)}>
        <span className="unova-panel" style={{ left: 8, top: 4, width: 240, height: 184 }} />
        <UnovaTitle x={11} y={9} width={234} title={t.draftTitle}>
          <span className="unova-text" style={{ right: 17, top: 14 }}>{t.draftPick(pick + 1, picks)}</span>
        </UnovaTitle>
        {candidates.map((candidate, i) => (
          <button key={candidate.id} type="button" className={i === index ? 'unova-bar unova-row' : 'unova-bar-off unova-row'}
            style={{ left: ROW.x, top: ROW.y + i * ROW.step, width: ROW.w, height: ROW.h }} aria-pressed={i === index}
            aria-label={draft.candidateLabel(i + 1, data.names.species[candidate.id] ?? candidate.id, candidate.typeNames.join(' y '), candidate.total)}
            onClick={() => setCursor(i)}>
            <span className="unova-row-icon"><MemberIcon spriteId={data.dex.species[candidate.id]?.spriteId ?? candidate.id} /></span>
            <span className="unova-text" style={{ left: 22, top: -2 }}>{data.names.species[candidate.id] ?? candidate.id}</span>
            <span className="unova-row-types">
              {(data.dex.species[candidate.id]?.types ?? []).map((type) => (
                <TypeBadge key={type} typeName={type} label={shortTypeLabel(type, data.names.types[type] ?? type)} />
              ))}
            </span>
            <span className="unova-text unova-soft" style={{ right: 0, top: -2 }}>{candidate.total}</span>
          </button>
        ))}
        <span className="unova-text unova-gold" style={{ left: 14, top: 143 }}>{t.draftRival(rivalName, level)}</span>
        <button type="button" className="unova-bar unova-button" style={{ left: 12, top: 160, width: 140, height: 24 }}
          aria-label={draft.recruitLabel(data.names.species[mon.id] ?? mon.id)} onClick={recruit}>
          <span className="unova-text" style={{ left: 8, top: -2 }}>{`▶ ${draft.recruit}`}</span>
        </button>
        {onShowTeam && (
          <button type="button" className="unova-bar-off unova-button" style={{ left: 156, top: 160, width: 88, height: 24 }}
            aria-label={t.yourTeamLabel} onClick={onShowTeam}>
            <span className="unova-text" style={{ left: 4, top: -2 }}>{t.yourTeam}</span>
          </button>
        )}
      </div>
    )]} />
  )
}
