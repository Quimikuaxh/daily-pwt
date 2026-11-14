/**
 * Ficha del rival de la campaña de Teselia (maqueta de la Ruta A3, 13/11/2026): ventana con la franja de título a la medida y el tipo,
 * el retrato, tres líneas (la del estado en dorado si es el próximo), el equipo en una cuadrícula de 2 x 3 (las casillas vacías, solo el
 * marco) y, si se pide, la tira de medallas y las flechas para pasar de rival. La usan la Ruta y la Liga.
 */
import type { ReactNode } from 'react'
import { MemberIcon } from '../battle/party/MemberIcon'
import { TypeBadge } from '../common/TypeBadge'
import { trainerSprite } from '../common/spriteUrls'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import type { CampaignEncounter } from '../campaign/hoennRoute'
import { unovaVars } from './unovaRoute'
import { UnovaTitle } from './UnovaTitle'
import './unova.css'

const t = esUnova
const route = esCampaign.route
/** Primera fila de la cuadrícula del equipo (2 columnas x 3 filas de 22 px, todo a 13 px). */
export const GRID_TOP = 86

type UnovaRivalCardProps = {
  rival: CampaignEncounter
  title: string
  /** Tipo del gimnasio (id en inglés) o `null`. */
  type: string | null
  lines: readonly string[]
  /** Índice de la línea que va en dorado (el estado «PRÓXIMO»), o `null`. */
  goldLine: number | null
  speciesName: (id: string) => string
  /** Flechas a los lados para pasar de rival: la etiqueta de cada una, o `null` si no hay rival en ese lado. */
  arrows?: { previous: string | null; next: string | null; onStep: (step: number) => void }
  /** Lo que va debajo de la ventana (la tira de medallas de la Ruta, el aviso de la Liga). */
  children?: ReactNode
}

export function UnovaRivalCard({ rival, title, type, lines, goldLine, speciesName, arrows, children }: UnovaRivalCardProps) {
  return (
    <div className="unova-card" style={unovaVars()} role="region" aria-label={route.cardLabel(rival.nameEs)}>
      <span className="unova-panel" style={{ left: 8, top: 4, width: 240, height: 150 }} />
      <UnovaTitle x={11} y={9} width={234} title={title} />
      {type && <span className="unova-type" style={{ right: 17, top: 12 }}><TypeBadge typeName={type} label={t.typeNames[type]} /></span>}
      <span className="unova-card-trainer">
        <img src={trainerSprite(rival.id)} alt="" />
      </span>
      {lines.map((line, i) => (
        <span key={i} className={`unova-text${i === goldLine ? ' unova-gold' : ' unova-soft'}`} style={{ left: 74, top: 36 + i * 15 }}>{line}</span>
      ))}
      <ul className="unova-card-team" aria-label={route.cardLabel(rival.nameEs)}>
        {Array.from({ length: 6 }, (_, slot) => {
          const member = rival.team[slot]
          return (
            <li key={slot} className="unova-bar-off" style={{ left: 11 + (slot % 2) * 118, top: GRID_TOP + Math.floor(slot / 2) * 22 }}
              aria-label={member ? route.memberLabel(speciesName(member.species), member.level) : undefined} aria-hidden={member ? undefined : true}>
              {member && (
                <>
                  <span className="unova-card-icon"><MemberIcon spriteId={member.species} /></span>
                  <span className="unova-text unova-card-name">{speciesName(member.species)}</span>
                  <span className="unova-text unova-soft unova-card-level">{t.level(member.level)}</span>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {arrows?.previous && (
        <button type="button" className="unova-text unova-arrow" style={{ left: 0, top: 60 }} onClick={() => arrows.onStep(-1)} aria-label={arrows.previous}>‹</button>
      )}
      {arrows?.next && (
        <button type="button" className="unova-text unova-arrow" style={{ left: 246, top: 60 }} onClick={() => arrows.onStep(1)} aria-label={arrows.next}>›</button>
      )}
      {children}
    </div>
  )
}
