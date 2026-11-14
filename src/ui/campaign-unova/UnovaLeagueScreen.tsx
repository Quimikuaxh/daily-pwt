/**
 * Liga de la campaña de Teselia (maqueta aprobada el 14/11/2026). Arriba, la ficha del rival que toca (Alto Mando o campeona) en el estilo
 * de la Ruta, con el progreso de la Liga y el aviso de la caja cerrada. Abajo, la pantalla de equipo del diario: los participantes en la
 * placa verde del juego con su orden (1.º, 2.º…) donde va el sexo; los que no participan, en azul; los caídos, en rojo. Tocar añade o
 * quita (leagueModel); ACEPTAR fija la plantilla, que ya no cambia hasta acabar la Liga, y con ella fijada lleva al combate.
 */
import { useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { uiAsset } from '../common/uiAssets'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import { participantText, toggleParticipant } from '../campaign/leagueModel'
import type { LeagueMember } from '../campaign/LeagueScreen'
import type { CampaignEncounter } from '../campaign/hoennRoute'
import { UnovaRivalCard } from './UnovaRivalCard'
import { PartyPlate } from './UnovaPartyPlates'
import '../battle/party/party.css'
import './unova.css'

const t = esCampaign.league
const u = esUnova

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
              const order = selected.indexOf(member.id)
              return (
                <PartyPlate key={member.id} member={member} index={index} order={order >= 0 ? order : null} lit={order === 0}
                  hpText={member.fainted ? t.notAbleShort : undefined}
                  label={t.memberLabel(member.name, member.level, participantText(member.id, member.fainted, selected))} onClick={() => choose(member)} />
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
