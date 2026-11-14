/**
 * Salón de la Fama de la campaña de Teselia (PRD §0, maqueta aprobada el 14/11/2026). En N2/B2 es una animación con piezas sueltas; aquí,
 * reconstruido: arriba, el protagonista con los supervivientes sobre la Poké Ball (UnovaHallStage), la banda «¡Campeón de la Liga!
 * ¡Enhorabuena!» y la barra con nombre, ID y tiempo; abajo, el equipo campeón en las placas de la pantalla de equipo del diario. Tocar
 * arriba o CANCELAR avanza (a la pantalla para compartir).
 */
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { esCampaign } from '../../i18n/esCampaign'
import { esUnova } from '../../i18n/esUnova'
import { useCampaignMusic } from '../campaign/campaignMusic'
import { TeamParty } from './UnovaPartyPlates'
import { UnovaHallStage } from './UnovaHallStage'
import { unovaMusic } from './unovaMusic'
import type { UnovaResultScreenProps } from './UnovaResultScreen'
import './unova.css'

const t = esCampaign.result
const u = esUnova

export function UnovaHallOfFame({ data, player, protagonist, card, team, onDone, reservedHeight, scale, music = unovaMusic }: UnovaResultScreenProps) {
  useCampaignMusic(music.result('hallOfFame'), music.register)
  const survivors = team.filter((member) => { return !member.fainted }).slice(0, 6)
  const names = survivors.map((member) => { return member.name }).join(', ')

  return (
    <div className="result-screen">
      <ConsoleStage theme={n2b2Theme} scale={scale} reservedHeight={reservedHeight} freeScreens={[0, 1]} screens={[(
        <div key="salon" className="unova-result-top">
          <UnovaHallStage data={data} members={survivors} protagonist={protagonist} band={u.hallBand} bar={[player, u.cardId(card.id), t.clock(card.minutes)]} />
          <button type="button" className="unova-result-continue" aria-label={u.hallLabel(names)} onClick={onDone} />
          <p className="sr-only" role="status">{`${t.hallOfFame} ${t.champions(names)}`}</p>
        </div>
      ), (
        <TeamParty key="equipo" team={team} prompt={u.hallTeam} screenLabel={t.screen} backLabel={u.hallNext}
          memberLabel={(member) => t.memberLabel(member.name, member.level, member.fainted, member.hp)} onBack={onDone} />
      )]} />
    </div>
  )
}
