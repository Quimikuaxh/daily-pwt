/**
 * Placas de la pantalla de equipo del diario (126 x 46, en dos columnas escalonadas) para las pantallas de Teselia: verde las elegidas
 * (con su orden, donde va el sexo), azul las demás y roja la de los caídos, con su icono, nombre, nivel y barra de PS. Van dentro de una
 * `.bt-party` subida 192 px (`unova-league-party`): las placas empiezan en y 201, la pantalla de abajo.
 */
import type { CSSProperties } from 'react'
import { MemberIcon } from '../battle/party/MemberIcon'
import { hpBar } from '../battle/party/hpBar'
import { PANEL, PANEL_HEIGHT, PANEL_WIDTH, panelPosition } from '../battle/party/layout'
import { uiAsset } from '../common/uiAssets'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import type { ResultMember } from '../campaign/ResultScreen'
import '../battle/party/party.css'

const u = esUnova

export type PlateMember = { id: string; species: string; name: string; level: number; hp: number; maxHp?: number; fainted: boolean }

type PlateProps = {
  member: PlateMember
  index: number
  /** Orden si está elegido (0, 1…), o `null`. */
  order: number | null
  /** Texto de PS (por defecto «PS/PS máx.»; a los caídos se les puede poner otro). */
  hpText?: string
  label: string
  /** Placa iluminada (la elegida primero o la del que estaba en combate). */
  lit?: boolean
  onClick?: () => void
}

export function PartyPlate({ member, index, order, hpText, label, lit = false, onClick }: PlateProps) {
  const position = panelPosition(index)
  const maxHp = member.maxHp ?? member.hp
  const color = member.fainted ? 'red' : order !== null ? 'green' : 'blue'
  const bar = hpBar({ hp: member.fainted ? 0 : member.hp, maxHp }, PANEL.barFill.width)
  const style = { left: position.x, top: position.y, width: PANEL_WIDTH, height: PANEL_HEIGHT,
    backgroundImage: `url(${uiAsset(`party/panel-${color}-${position.side}${lit ? '-lit' : ''}.png`)})` } as CSSProperties
  const visual = (
    <span className="bt-party-visual" aria-hidden="true">
      <span className="bt-party-icon" style={{ left: PANEL.icon.x, top: PANEL.icon.y }}><MemberIcon spriteId={member.species} dimmed={member.fainted} /></span>
      <span className="bt-party-name" style={{ left: PANEL.name.x, top: PANEL.name.y }}>{member.name}</span>
      {order !== null && <span className="bt-party-name unova-league-order" style={{ left: PANEL.gender.x - 4, top: PANEL.name.y }}>{u.leagueOrder(order + 1)}</span>}
      <img className="bt-party-bar" style={{ left: PANEL.bar.x, top: PANEL.bar.y }} src={uiAsset('party/hp-track.png')} alt="" />
      <span className="bt-party-fill" data-fill={bar.color} style={{ left: PANEL.barFill.x, top: PANEL.barFill.y, width: bar.width }} />
      <span className="bt-party-level" style={{ left: PANEL.level.x, top: PANEL.level.y }}>{u.level(member.level)}</span>
      <span className="bt-party-hp" style={{ right: PANEL_WIDTH - 106, top: PANEL.hp.y }}>{hpText ?? `${member.fainted ? 0 : member.hp}/${maxHp}`}</span>
    </span>
  )
  if (onClick) {
    return <button type="button" className="bt-party-panel" style={style} aria-label={label} aria-pressed={order !== null} onClick={onClick}>{visual}</button>
  }
  return <div className="bt-party-panel" style={style} role="listitem" aria-label={label}>{visual}</div>
}

type TeamPartyProps = {
  team: readonly ResultMember[]
  /** Texto de la barra de abajo. */
  prompt: string
  screenLabel: string
  backLabel: string
  memberLabel: (member: ResultMember) => string
  onBack: () => void
}

/**
 * Pantalla de abajo con el equipo en placas (solo para ver: Resultado y Salón de la Fama): el primero que sigue en pie, iluminado; los
 * caídos, en rojo con «Debilitado». CANCELAR (la flecha) avanza.
 */
export function TeamParty({ team, prompt, screenLabel, backLabel, memberLabel, onBack }: TeamPartyProps) {
  const lead = team.findIndex((member) => { return !member.fainted })
  return (
    <div className="unova-league-party">
      <section className="bt-party" aria-label={screenLabel}>
        <img className="bt-party-bg bt-party-bg-bottom" src={uiAsset('party/bg-bottom.png')} alt="" />
        <div role="list">
          {team.slice(0, 6).map((member, i) => (
            <PartyPlate key={i} member={{ ...member, id: String(i) }} index={i} order={null} lit={i === lead}
              hpText={member.fainted ? esCampaign.battle.fainted : undefined} label={memberLabel(member)} />
          ))}
        </div>
        <img className="bt-party-toolbar" src={uiAsset('party/bar.png')} alt="" />
        <p className="bt-party-prompt unova-league-prompt">{prompt}</p>
        <button type="button" className="bt-party-back" onClick={onBack}><span className="sr-only">{backLabel}</span></button>
      </section>
    </div>
  )
}
