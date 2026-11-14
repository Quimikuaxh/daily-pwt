/**
 * Pantalla final de la campaña de Teselia para compartir (PRD §0, «Locke de N2/B2: compartir», 14/11/2026): como la de Hoenn, una imagen
 * de las dos pantallas (768 x 1152: las de N2/B2 miden 256 x 192). Arriba, el Salón de la Fama (UnovaHallStage) con los que ganaron la Liga, o los del último combate
 * en gris con «Derrota ante …» en la banda, y en la barra el nombre, «NUZLOCKE · TESELIA» y la fecha; abajo, la Ficha con especies,
 * bajas, tiempo y las medallas. Suenan los créditos.
 */
import { useRef } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import { useCampaignMusic } from '../campaign/campaignMusic'
import { ShareActions, type ShareScreenProps } from '../campaign/ShareScreen'
import type { GameData } from '../../core/types'
import { UnovaHallStage } from './UnovaHallStage'
import { UnovaTrainerCard } from './UnovaTrainerCard'
import { unovaMusic } from './unovaMusic'
import './unova.css'

const s = esCampaign.share
const r = esCampaign.result
const u = esUnova

export function UnovaShareScreen({ data, won, player, protagonist, rival, team, card, date, reservedHeight, scale, music = unovaMusic }: ShareScreenProps & { data: GameData }) {
  useCampaignMusic(music.credits, music.register)
  const stage = useRef(null as HTMLDivElement | null)
  const band = won ? u.hallBand : u.shareLost(rival)
  const names = team.map((member) => { return member.name }).join(', ')
  const rows = [[u.cardSpecies, String(card.pokedex)], [s.fainted, String(card.fainted)], [u.cardTime, r.clock(card.minutes)]] as const

  return (
    <div className="share-screen" ref={stage}>
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} freeScreens={[0, 1]} screens={[(
        <div key="salon" className="unova-result-top" role="img" aria-label={`${band}. ${r.champions(names)}`}>
          <UnovaHallStage data={data} members={team} fallen={!won} protagonist={protagonist} band={band} bar={[player, u.shareMode, u.shareDate(date)]} />
        </div>
      ), (
        <div key="ficha" className="unova-abs unova-result-card" role="img"
          aria-label={s.cardText(player, card.id, card.pokedex, card.fainted, r.clock(card.minutes), card.badges)}>
          <UnovaTrainerCard player={player} id={card.id} rows={rows} protagonist={protagonist} badges={card.badges} />
        </div>
      )]} />
      <ShareActions stage={stage} fileName={u.shareFile(date)} text={u.shareText(player, won, rival)} />
    </div>
  )
}
