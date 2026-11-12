/**
 * Pantalla de la Liga de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, la ficha del Domo Batalla del siguiente rival (Alto
 * Mando o campeón) con el progreso de la Liga. Abajo, la elección de participantes del Frente Batalla sobre el equipo: tocar añade o
 * quita, y cada hueco dice APTO, NO APTO (los caídos) o su orden en lugar de los PS. ACEPTAR fija la plantilla, que ya no cambia hasta
 * acabar la Liga; con la plantilla fijada, ACEPTAR lleva al combate con el siguiente rival.
 */
import { useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { DomeCard } from './DomeCard'
import { PartySlot } from './PartySlot'
import { slotBox } from './partySlotModel'
import { participantText, toggleParticipant } from './leagueModel'
import type { CampaignEncounter } from './hoennRoute'

const t = esCampaign.league

export type LeagueMember = { id: string; species: string; name: string; level: number; hp: number; fainted: boolean }

type LeagueScreenProps = {
  rival: CampaignEncounter
  beaten: number
  /** Los del equipo (hasta 6), en su orden. */
  members: readonly LeagueMember[]
  /** Plantilla ya fijada (combates siguientes) o `null` si aún se elige. */
  roster: readonly string[] | null
  speciesName: (id: string) => string
  onAccept: (selected: string[]) => void
  onCancel: () => void
  scale?: number
  reservedHeight?: number
}

export function LeagueScreen({ rival, beaten, members, roster, speciesName, onAccept, onCancel, scale, reservedHeight }: LeagueScreenProps) {
  const [selected, setSelected] = useState(() => [...(roster ?? [])])
  const [cursor, setCursor] = useState(0)
  const [note, setNote] = useState(null as string | null)
  const [page, setPage] = useState(0)
  const locked = roster !== null
  const party = rival.team.map((member) => ({ species: member.species, name: speciesName(member.species), level: member.level }))
  const title = rival.kind === 'champion' ? t.championTitle(rival.nameEs) : t.eliteTitle(rival.nameEs)
  // Nivel máximo de todo el equipo del rival, no solo de los que se ven en la ficha (Jose, 12/11/2026).
  const lines = () => [t.progress(beaten), t.levels(rival.team.map((member) => member.level)), t.boxClosed]
  const prompt = note ?? (locked ? t.locked : t.choose)
  const names = selected.map((id) => members.find((member) => { return member.id === id })?.name ?? id).join(', ')

  const choose = (i: number) => {
    setCursor(i)
    if (locked) return
    const member = members[i]
    if (!member) return
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
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <DomeCard key="card" rivalId={rival.id} title={title} party={party} page={page} onPage={setPage} lines={lines}
          accessibleName={t.cardLabel(rival.nameEs)}
          accessibleText={`${title}. ${lines().join(' ')}`} />
      ), (
        <div key="party" className="league-party">
          <img src={emeraldTheme.asset('equipo-fondo')} alt="" style={{ left: 0, top: 0 }} />
          {Array.from({ length: 6 }, (_, i) => {
            const member = members[i] ?? null
            const r = slotBox(i)
            const text = member ? participantText(member.id, member.fainted, selected) : ''
            const state = member?.fainted ? (i === cursor ? 'ko-activa' : 'ko') : i === cursor ? 'activa' : 'normal'
            return (
              <button key={i} type="button" className="team-cell" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                aria-label={member ? t.memberLabel(member.name, member.level, text) : esCampaign.battle.emptySlot(i + 1)}
                aria-pressed={member ? selected.includes(member.id) : undefined} disabled={!member}
                onClick={() => choose(i)}>
                <PartySlot i={i} mon={member && { ...member, maxHp: member.hp }} state={state} description={member ? text : undefined} bounce={i === cursor && !member?.fainted} />
              </button>
            )
          })}
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={prompt} y={1} width={168} fit hidden />
          </GameWindow>
          <button type="button" className="team-button" style={{ left: 184, top: 128, width: 56, height: 16 }} aria-label={locked ? t.fightLabel : t.acceptLabel} onClick={accept}>
            <GameText text={t.accept} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
          </button>
          <button type="button" className="team-button" style={{ left: 184, top: 144, width: 56, height: 16 }} aria-label={t.cancelLabel} onClick={onCancel}>
            <GameText text={t.cancel} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
          </button>
          <p className="sr-only" role="status">{`${prompt} ${t.status(selected.length, names)}${locked ? ` ${t.lockedNote}` : ''}`}</p>
        </div>
      )]} />
    </div>
  )
}
