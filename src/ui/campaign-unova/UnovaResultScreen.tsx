/**
 * Resultado de un combate de la campaña de Teselia (maqueta aprobada el 14/11/2026). Primero, el rival sobre el escenario del combate del
 * diario con el mensaje en su franja (medalla, «Has vencido a…» o derrota) y abajo el equipo con las placas del diario (los caídos, en
 * rojo). Tras una medalla, arriba el estuche de medallas de la Ficha de N2/B2 (las conseguidas, en su hueco) con el mensaje, y abajo la
 * Ficha de Entrenador (nombre, ID, PB, especies y tiempo) con el protagonista. Tocar arriba avanza; CANCELAR vuelve a la Ruta.
 *
 * El Salón de la Fama (tras la campeona) es su propia pantalla (UnovaHallOfFame); aquí, en ese modo, solo se pasa a él.
 */
import { useState } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { uiAsset } from '../common/uiAssets'
import { trainerSprite } from '../common/spriteUrls'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import type { ResultMember } from '../campaign/ResultScreen'
import type { Protagonist, ResultMode } from '../campaign/resultModel'
import { wrapText } from '../campaign/draftModel'
import { RevealWhenLoaded } from '../campaign/RevealWhenLoaded'
import { n2b2Ui, unovaVars } from './unovaRoute'
import { textWidthAt } from './unovaText'
import { TeamParty } from './UnovaPartyPlates'
import { UnovaTrainerCard } from './UnovaTrainerCard'
import { UnovaHallOfFame } from './UnovaHallOfFame'
import { unovaMusic } from './unovaMusic'
import { useCampaignMusic, type CampaignMusic } from '../campaign/campaignMusic'
import type { GameData } from '../../core/types'
import '../battle/battle.css'
import './unova.css'

const t = esCampaign.result
const u = esUnova
/** Izquierda, arriba, ancho y alto de cada medalla a escala original, alineada con su silueta en ficha-estuche.png. */
const BADGE_SLOTS = [
  [10, 97, 12, 58], [33, 99, 30, 55], [68, 98, 24, 56], [100, 97, 24, 57],
  [135, 97, 17, 56], [165, 98, 20, 57], [192, 98, 30, 54], [229, 99, 23, 55],
] as const

export type UnovaResultScreenProps = {
  data: GameData
  music?: CampaignMusic
  mode: ResultMode
  message: string
  player: string
  protagonist: Protagonist
  badges: number
  badgeNames: readonly string[]
  card: { id: string; points: number; pokedex: number; minutes: number }
  team: readonly ResultMember[]
  trainer?: string | null
  onDone: () => void
  reservedHeight?: number
  scale?: number
}

/** Mensaje en páginas de dos líneas de la franja del combate (16 px en 240 de ancho). */
const pagesOf = (message: string): string[][] => {
  const lines = wrapText(message, 236, (line) => textWidthAt(16, line))
  return Array.from({ length: Math.ceil(lines.length / 2) }, (_, i) => lines.slice(i * 2, i * 2 + 2))
}

export function UnovaResultScreen(props: UnovaResultScreenProps) {
  return props.mode === 'hallOfFame' ? <UnovaHallOfFame {...props} /> : <BattleResult {...props} />
}

function BattleResult({ mode, message, player, protagonist, badges, badgeNames, card, team, trainer = null, onDone, reservedHeight, scale, music = unovaMusic }: UnovaResultScreenProps) {
  useCampaignMusic(music.result(mode), music.register)
  const [showCard, setShowCard] = useState(false)
  const [page, setPage] = useState(0)
  const pages = pagesOf(message)
  const advance = () => {
    if (page + 1 < pages.length) { setPage(page + 1); return }
    if (mode === 'medal' && !showCard) { setShowCard(true); return }
    onDone()
  }
  const earned = badgeNames.slice(0, badges).join(', ')
  const accessible = showCard ? t.cardText(player, card.id, card.points, card.pokedex, t.clock(card.minutes), earned)
    : mode === 'whiteout' ? `${message} ${t.ended}` : message
  const rows: readonly (readonly [string, string])[] = [[u.cardPoints, t.points(card.points)], [u.cardSpecies, String(card.pokedex)], [u.cardTime, t.clock(card.minutes)]]

  const top = showCard ? (
    <div key="estuche" className="unova-abs unova-screen" style={unovaVars()}>
      <img src={n2b2Ui('ficha-estuche')} alt="" style={{ left: 0, top: 0 }} />
      {BADGE_SLOTS.slice(0, badges).map(([left, top, width, height], i) => (
        <img key={i} className="unova-result-case-badge" src={n2b2Ui(`medalla-estuche-${i + 1}`)} alt=""
          width={width} height={height} style={{ left, top }} />
      ))}
      <div className="bt-message unova-result-message"><p className="bt-message-text">{pages.at(-1)?.join(' ')}</p></div>
    </div>
  ) : (
    <div key="campo" className="unova-result-field">
      <img className="unova-result-bg" src={uiAsset('bg/building.png')} alt="" />
      {trainer && mode !== 'whiteout' && <img className="unova-result-trainer bt-trainer-rival" src={trainerSprite(trainer)} alt="" />}
      <div className="bt-message"><p className="bt-message-text">{(pages[page] ?? []).join(' ')}</p></div>
    </div>
  )

  const bottom = () => { return showCard ? (
    <div key="ficha" className="unova-abs unova-screen unova-result-card" style={unovaVars()}>
      <UnovaTrainerCard player={player} id={card.id} rows={rows} protagonist={protagonist} />
    </div>
  ) : (
    <TeamParty key="equipo" team={team} prompt={team.some((member) => { return !member.fainted }) ? u.resultTeam : t.none} screenLabel={t.screen}
      backLabel={t.cancelLabel} memberLabel={(member) => t.memberLabel(member.name, member.level, member.fainted, member.hp)} onBack={onDone} />
  ) }

  return (
    <div className="result-screen">
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} freeScreens={[0, 1]} screens={[(
        <div key="top" className="unova-result-top">
          <RevealWhenLoaded key={showCard ? 'ficha' : 'mensaje'}>{top}</RevealWhenLoaded>
          <button type="button" className="unova-result-continue" aria-label={showCard ? t.cardLabel : t.continueLabel(message)} onClick={advance} />
          <p className="sr-only" role="status">{accessible}</p>
        </div>
      ), bottom()]} />
    </div>
  )
}
