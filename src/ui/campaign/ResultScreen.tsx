/**
 * Pantalla Resultado de la campaña (D7, maqueta aprobada el 11/11/2026). Arriba, según el combate: el mensaje en la caja del combate
 * (medalla, «Has vencido a…» o derrota) y, tras la medalla, la Ficha de Entrenador con las medallas; tras el campeón, el Salón de la Fama
 * con los supervivientes (hall_of_fame.c). Abajo, el equipo con las bajas (party_menu.c). Tocar arriba avanza; CANCELAR vuelve a la Ruta.
 */
import { textWidth } from '../console/glyphs'
import type { BitmapFont } from '../console/theme'
import { MessageArrow } from './MessageArrow'
import { useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { PartySlot } from './PartySlot'
import { slotBox } from './partySlotModel'
import { messagePages } from './emeraldBattleModel'
import { hallOfFameOrder, hallOfFameSpots, type Protagonist, type ResultMode } from './resultModel'
import { resultMusic, useCampaignMusic } from './campaignMusic'

const t = esCampaign.result
const font = emeraldTheme.font as BitmapFont

export type ResultMember = { species: string; name: string; level: number; hp: number; fainted: boolean }

type ResultScreenProps = {
  mode: ResultMode
  message: string
  player: string
  protagonist: Protagonist
  /** Medallas conseguidas (1 a 8), para la ficha. */
  badges: number
  badgeNames: readonly string[]
  card: { id: string; points: number; pokedex: number; minutes: number }
  team: readonly ResultMember[]
  /** Rival vencido (`lider-*`): vuelve a salir en el campo mientras habla, como el juego al dar la medalla (Jose, 12/11/2026). */
  trainer?: string | null
  onDone: () => void
  reservedHeight?: number
  scale?: number
}

export function ResultScreen({ mode, message, player, protagonist, badges, badgeNames, card, team, trainer = null, onDone, reservedHeight, scale }: ResultScreenProps) {
  useCampaignMusic(resultMusic(mode))
  const [showCard, setShowCard] = useState(false)
  const [page, setPage] = useState(0)
  const pages = messagePages(message)
  const survivors = team.filter((member) => !member.fainted)
  const advance = () => {
    if (page + 1 < pages.length) { setPage(page + 1); return }
    if (mode === 'medal' && !showCard) { setShowCard(true); return }
    onDone()
  }
  const lastLine = pages[page]?.at(-1) ?? null
  const stats: [string, string, number][] = [[t.money, t.points(card.points), 65], [t.pokedex, String(card.pokedex), 81], [t.time, t.clock(card.minutes), 97]]
  const earned = badgeNames.slice(0, badges).join(', ')
  const accessible = showCard
    ? t.cardText(player, card.id, card.points, card.pokedex, t.clock(card.minutes), earned)
    : mode === 'hallOfFame' ? `${message} ${t.champions(survivors.map((member) => member.name).join(', '))}`
      : mode === 'whiteout' ? `${message} ${t.ended}` : message

  const hallOfFame = () => {
    return (
      <>
        <img src={emeraldTheme.asset('resultado-salon')} alt="" style={{ left: 0, top: 0 }} />
        {/* De arriba abajo: la fila de abajo queda delante (hallOfFameOrder). */}
        {hallOfFameOrder(survivors.length).map((i) => {
          const member = survivors[i]
          const [x, y] = hallOfFameSpots(survivors.length)[i]
          return <img key={`${member.species}-${i}`} className="mon-front" src={emeraldSprite('front', member.species)} alt="" style={{ left: x - 32, top: y - 32 }} />
        })}
        <GameText text={message} x={16} y={121} width={208} align="center" color="salon" hidden />
      </>
    )
  }
  const trainerCard = () => {
    return (
      <>
        <img src={emeraldTheme.asset('resultado-tarjeta')} alt="" style={{ left: 0, top: 0 }} />
        <GameText text={t.name(player)} x={24} y={41} hidden />
        <GameText text={t.id(card.id)} x={128} y={17} width={96} align="center" hidden />
        {stats.map(([label, value, y]) => (
          <span key={label}>
            <GameText text={label} x={24} y={y} hidden />
            <GameText text={value} x={24} y={y} width={112} align="right" hidden />
          </span>
        ))}
        <img src={emeraldTheme.asset(`entrenador-${protagonist}`)} alt="" style={{ left: 153, top: 40 }} />
        {Array.from({ length: badges }, (_, i) => (
          <img key={i} src={emeraldTheme.asset(`medalla-${i + 1}`)} alt="" style={{ left: 32 + 24 * i, top: 120 }} />
        ))}
      </>
    )
  }
  const battleMessage = () => {
    return (
      <>
        <img src={emeraldTheme.asset('combate-escenario')} alt="" style={{ left: 0, top: 0 }} />
        {/* El rival, sobre su plataforma (centro del sprite del rival en (176,40), como sus Pokémon). */}
        {trainer && mode !== 'whiteout' && <img src={emeraldTheme.asset(`lider-${trainer}`)} alt="" style={{ left: 144, top: 8 }} />}
        <img src={emeraldTheme.asset('combate-caja-mensaje')} alt="" style={{ left: 0, top: 112 }} />
        {(pages[page] ?? []).map((line, i) => <GameText key={i} text={line} x={16} y={121 + 16 * i} color="combate-mensaje" hidden />)}
        {lastLine !== null && <MessageArrow x={16 + textWidth(font, lastLine) + 1} y={120 + 16 * ((pages[page]?.length ?? 1) - 1)} />}
      </>
    )
  }
  const topContent = () => {
    if (mode === 'hallOfFame') return hallOfFame()
    if (showCard) return trainerCard()
    return battleMessage()
  }

  return (
    <div className="result-screen">
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="top" className="result-top">
          {topContent()}
          <button type="button" className="result-continue" style={{ left: 0, top: 0, width: 240, height: 160 }}
            aria-label={showCard ? t.cardLabel : t.continueLabel(message)} onClick={advance} />
          <p className="sr-only" role="status">{accessible}</p>
        </div>
      ), (
        <div key="party" className="result-party">
          <img src={emeraldTheme.asset('equipo-fondo-combate')} alt="" style={{ left: 0, top: 0 }} />
          {Array.from({ length: 6 }, (_, i) => {
            const member = team[i] ?? null
            const r = slotBox(i)
            return (
              <div key={i} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} aria-hidden="true">
                <PartySlot i={i} mon={member && { ...member, maxHp: member.hp }} state={member?.fainted ? (i === 0 ? 'ko-activa' : 'ko') : i === 0 ? 'activa' : 'normal'} description={member?.fainted ? esCampaign.battle.fainted : undefined} />
              </div>
            )
          })}
          <ul className="sr-only">
            {team.map((member, i) => <li key={i}>{t.memberLabel(member.name, member.level, member.fainted, member.hp)}</li>)}
          </ul>
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={survivors.length ? t.choose : t.none} y={1} width={168} fit hidden />
          </GameWindow>
          <button type="button" className="team-button" style={{ left: 184, top: 136, width: 56, height: 16 }} aria-label={t.cancelLabel} onClick={onDone}>
            <GameText text={t.cancel} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
          </button>
        </div>
      )]} />
    </div>
  )
}
