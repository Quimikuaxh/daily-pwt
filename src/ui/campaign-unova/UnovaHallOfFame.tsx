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
import { uiAsset } from '../common/uiAssets'
import { MemberIcon } from '../battle/party/MemberIcon'
import { PANEL, PANEL_HEIGHT, PANEL_WIDTH } from '../battle/party/layout'
import { unovaVars } from './unovaRoute'
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
        // Abajo, como la maqueta: la barra «SALÓN DE LA FAMA» y una placa azul por superviviente (icono, nombre y nivel; sin PS).
        <div key="equipo" className="unova-abs unova-screen" style={unovaVars()}>
          <img src={uiAsset('party/bg-bottom.png')} alt="" style={{ left: 0, top: 0 }} />
          <span className="unova-bar" style={{ left: 15, top: 6, width: 226, height: 22 }} />
          <span className="unova-text" style={{ left: 24, top: 11 }}>{u.hallTitle}</span>
          <ul aria-label={u.hallTeam}>
            {survivors.map((member, i) => {
              const x = 1 + (i % 2) * 128
              const y = 32 + Math.floor(i / 2) * 50
              return (
                <li key={i} aria-label={t.memberLabel(member.name, member.level, false, member.hp)} style={{ left: x, top: y, width: PANEL_WIDTH, height: PANEL_HEIGHT }}>
                  <img src={uiAsset('party/panel-blue-left.png')} alt="" style={{ left: 0, top: 0 }} />
                  <span style={{ left: PANEL.icon.x, top: PANEL.icon.y }}><MemberIcon spriteId={member.species} /></span>
                  <span className="unova-text" style={{ left: 36, top: 8 }}>{member.name}</span>
                  <span className="unova-text" style={{ left: 36, top: 24 }}>{u.level(member.level)}</span>
                </li>
              )
            })}
          </ul>
          <button type="button" className="unova-result-continue" aria-label={u.hallNext} onClick={onDone} />
        </div>
      )]} />
    </div>
  )
}
