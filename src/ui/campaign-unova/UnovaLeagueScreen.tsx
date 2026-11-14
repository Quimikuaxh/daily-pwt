/**
 * Liga de la campaña de Teselia (maqueta aprobada el 14/11/2026). Arriba, la ficha del rival que toca (Alto Mando o campeona) en el estilo
 * de la Ruta, con el progreso de la Liga y el aviso de la caja cerrada. Abajo, la pantalla de equipo del diario: los participantes en la
 * placa verde del juego con su orden (1.º, 2.º…) donde va el sexo; los que no participan, en azul; los caídos, en rojo. Tocar añade o
 * quita (leagueModel); ACEPTAR fija la plantilla, que ya no cambia hasta acabar la Liga, y con ella fijada lleva al combate.
 */
import { useState, type CSSProperties } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { MemberIcon } from '../battle/party/MemberIcon'
import { hpBar } from '../battle/party/hpBar'
import { PANEL, PANEL_HEIGHT, PANEL_WIDTH, panelPosition } from '../battle/party/layout'
import { uiAsset } from '../common/uiAssets'
import { esCampaign } from '../../i18n/esCampaign'
import { participantText, toggleParticipant } from '../campaign/leagueModel'
import type { LeagueMember } from '../campaign/LeagueScreen'
import type { CampaignEncounter } from '../campaign/hoennRoute'
import { UnovaRivalCard } from './UnovaRivalCard'
import '../battle/party/party.css'
import './unova.css'

const t = esCampaign.league
const u = esCampaign.unova

export type UnovaLeagueScreenProps = {
  rival: CampaignEncounter
  beaten: number
  members: readonly LeagueMember[]
  roster: readonly string[] | null
  speciesName: (id: string) => string
  onAccept: (selected: string[]) => void
  onCancel: () => void
  scale?: number
  reservedHeight?: number
}

export function UnovaLeagueScreen({ rival, beaten, members, roster, speciesName, onAccept, onCancel, scale, reservedHeight }: UnovaLeagueScreenProps) {
  const [selected, setSelected] = useState(() => [...(roster ?? [])])
  const [note, setNote] = useState(null as string | null)
  const locked = roster !== null
  const title = rival.kind === 'champion' ? u.championTitle(rival.nameEs) : u.eliteTitle(rival.nameEs)
  const lines = [u.leagueProgress(beaten), u.leagueMaxLevel(Math.max(...rival.team.map((member) => member.level))), u.leagueBoxClosed]
  const prompt = note ?? (locked ? u.leagueLocked : u.leagueChoose)
  const names = selected.map((id) => members.find((member) => { return member.id === id })?.name ?? id).join(', ')

  const choose = (member: LeagueMember) => {
    if (locked) return
    if (member.fainted) { setNote(t.notAble); return }
    setNote(null)
    setSelected(toggleParticipant(selected, member.id))
  }
  const accept = () => {
    if (!selected.length) { setNote(t.needOne); return }
    onAccept(selected)
  }

  return (
    <div className="league-screen">
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} freeScreens={[1]} screens={[(
        <UnovaRivalCard key="card" rival={rival} title={title} type={null} lines={lines} goldLine={null}
          speciesName={(id) => speciesName(id)} />
      ), (
        // La pantalla de equipo del diario mide las dos pantallas (sus placas empiezan en y 201): se sube 192 px y se ve la de abajo.
        <div key="party" className="unova-league-party">
          <section className="bt-party" aria-label={t.screen}>
            <img className="bt-party-bg bt-party-bg-bottom" src={uiAsset('party/bg-bottom.png')} alt="" />
            {members.slice(0, 6).map((member, index) => {
              const position = panelPosition(index)
              const order = selected.indexOf(member.id)
              const color = member.fainted ? 'red' : order >= 0 ? 'green' : 'blue'
              const text = participantText(member.id, member.fainted, selected)
              const bar = hpBar({ hp: member.fainted ? 0 : member.hp, maxHp: member.hp }, PANEL.barFill.width)
              const style = { left: position.x, top: position.y, width: PANEL_WIDTH, height: PANEL_HEIGHT,
                backgroundImage: `url(${uiAsset(`party/panel-${color}-${position.side}${order === 0 ? '-lit' : ''}.png`)})` } as CSSProperties
              return (
                <button key={member.id} type="button" className="bt-party-panel" style={style}
                  aria-label={t.memberLabel(member.name, member.level, text)} aria-pressed={order >= 0} onClick={() => choose(member)}>
                  <span className="bt-party-visual" aria-hidden="true">
                    <span className="bt-party-icon" style={{ left: PANEL.icon.x, top: PANEL.icon.y }}><MemberIcon spriteId={member.species} dimmed={member.fainted} /></span>
                    <span className="bt-party-name" style={{ left: PANEL.name.x, top: PANEL.name.y }}>{member.name}</span>
                    {order >= 0 && <span className="bt-party-name unova-league-order" style={{ left: PANEL.gender.x - 4, top: PANEL.name.y }}>{u.leagueOrder(order + 1)}</span>}
                    <img className="bt-party-bar" style={{ left: PANEL.bar.x, top: PANEL.bar.y }} src={uiAsset('party/hp-track.png')} alt="" />
                    <span className="bt-party-fill" data-fill={bar.color} style={{ left: PANEL.barFill.x, top: PANEL.barFill.y, width: bar.width }} />
                    <span className="bt-party-level" style={{ left: PANEL.level.x, top: PANEL.level.y }}>{esCampaign.unova.level(member.level)}</span>
                    <span className="bt-party-hp" style={{ right: PANEL_WIDTH - 106, top: PANEL.hp.y }}>{member.fainted ? t.notAbleShort : `${member.hp}/${member.hp}`}</span>
                  </span>
                </button>
              )
            })}
            <img className="bt-party-toolbar" src={uiAsset('party/bar.png')} alt="" />
            <p className="bt-party-prompt unova-league-prompt" role="status">{prompt}</p>
            <button type="button" className="bt-party-rival unova-league-accept" aria-label={locked ? t.fightLabel : t.acceptLabel} onClick={accept}>
              <span aria-hidden="true">{t.accept}</span>
            </button>
            <button type="button" className="bt-party-cancel" onClick={onCancel} aria-hidden="true" tabIndex={-1} />
            <button type="button" className="bt-party-back" onClick={onCancel}>
              <span className="sr-only">{t.cancelLabel}</span>
            </button>
            <p className="sr-only">{`${t.status(selected.length, names)}${locked ? ` ${t.lockedNote}` : ''}`}</p>
          </section>
        </div>
      )]} />
    </div>
  )
}
