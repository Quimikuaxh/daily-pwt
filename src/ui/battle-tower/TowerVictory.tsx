/**
 * Victoria de la Torre Batalla (Jose, 17/11/2026, maqueta A: docs/maquetas/torre/victoria.png), al estilo del Salón de la Fama de Teselia.
 * Arriba, el escenario del PWT con la banda, los seis líderes al fondo en el orden en que cayeron y el campeón delante, y la barra con el
 * jugador, las victorias y el campeón; abajo, el equipo en las placas de la pantalla de equipo. Debajo, Nueva serie y Volver a Hoy.
 */
import type { CSSProperties } from 'react'
import type { GameData } from '../../core/types'
import type { TowerRun } from '../../core/battle-tower/tower'
import { TOWER_ROUNDS } from '../../core/battle-tower/tower'
import { esTower as t } from '../../i18n/esTower'
import { ConsoleStage } from '../console/ConsoleStage'
import { n2b2Theme } from '../console/themes/n2b2'
import { PixelText } from '../campaign-unova/PixelText'
import { HALL_BAND, HALL_BAR, HALL_COLORS } from '../campaign-unova/unovaHall'
import { unovaVars } from '../campaign-unova/unovaRoute'
import { MemberIcon } from '../battle/party/MemberIcon'
import { PANEL, PANEL_HEIGHT, PANEL_WIDTH } from '../battle/party/layout'
import { uiAsset } from '../common/uiAssets'
import { trainerVsSprite } from '../common/spriteUrls'
import '../campaign-unova/unova.css'

/** Centros de los seis líderes al fondo, dejando el hueco del centro al campeón (px del juego). */
const LEADER_X = [24, 60, 96, 160, 196, 232] as const
const RESERVED_HEIGHT = 200

type Props = {
  data: GameData
  run: TowerRun
  title: string
  playerName?: string
  busy?: boolean
  onNewSeries: () => void
  onExit: () => void
}

export function TowerVictory({ data, run, title, playerName, busy = false, onNewSeries, onExit }: Props) {
  return (
    <div className="tower-team-console tower-victory">
      <h1>{title}</h1>
      <section aria-labelledby="tower-victory-title">
        <h2 id="tower-victory-title" className="sr-only">{`${t.won}. ${t.wins(TOWER_ROUNDS, TOWER_ROUNDS)}`}</h2>
        <ConsoleStage theme={n2b2Theme} reservedHeight={RESERVED_HEIGHT} freeScreens={[0, 1]} screens={[<VictoryStage key="escenario" run={run} playerName={playerName} />, <VictoryTeam key="equipo" data={data} run={run} />]} />
        <h3 className="sr-only">{t.victory.beaten}</h3>
        <ol className="sr-only">
          {run.rivals.map((rival, i) => <li key={rival.trainer.id}>{i === run.rivals.length - 1 ? t.victory.champion(rival.trainer.nameEs) : rival.trainer.nameEs}</li>)}
        </ol>
        <h3 className="sr-only">{t.team}</h3>
        <ul className="sr-only">
          {run.team.map((member) => <li key={member.species}>{t.victory.member(member.nameEs, member.level)}</li>)}
        </ul>
      </section>
      <div className="tower-victory-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onNewSeries}>{t.newRun}</button>
        <button type="button" className="btn" onClick={onExit}>{t.back}</button>
      </div>
    </div>
  )
}

/** Pantalla de arriba: escenario del PWT, banda, los seis líderes al fondo y el campeón delante, y la barra de abajo. */
function VictoryStage({ run, playerName }: Pick<Props, 'run' | 'playerName'>) {
  const leaders = run.rivals.slice(0, -1)
  const champion = run.rivals[run.rivals.length - 1]
  const figure = (style: CSSProperties): CSSProperties => ({ position: 'absolute', imageRendering: 'pixelated', transform: 'translateX(-50%)', ...style })
  return (
    <div className="unova-hall" aria-hidden="true">
      <img src={uiAsset('pwt-stage.png')} alt="" style={{ position: 'absolute', left: 0, top: 0, width: 256, height: 192 }} />
      <span className="tower-victory-band" style={{ top: HALL_BAND.top, height: HALL_BAND.bottom - HALL_BAND.top + 1, background: HALL_COLORS.band }} />
      <PixelText text={t.victory.band} left={0} top={HALL_BAND.top + 2} width={256} align="center" color={HALL_COLORS.bandText} shadow={null} />
      {leaders.map((rival, i) => (
        <img key={rival.trainer.id} src={trainerVsSprite(rival.trainer.sprite)} alt=""
          style={figure({ left: LEADER_X[i], top: 44, height: 64, maxWidth: 40, objectFit: 'contain' })} />
      ))}
      <img src={trainerVsSprite(champion.trainer.sprite)} alt="" style={figure({ left: 128, top: 70, height: 92 })} />
      <span className="tower-victory-band" style={{ top: HALL_BAR.top, height: 192 - HALL_BAR.top, background: HALL_COLORS.bar, borderTop: `1px solid ${HALL_COLORS.barLine}` }} />
      <PixelText text={(playerName || t.victory.you).toUpperCase()} left={8} top={HALL_BAR.top + 5} />
      <PixelText text={t.wins(TOWER_ROUNDS, TOWER_ROUNDS)} left={0} top={HALL_BAR.top + 5} width={256} align="center" />
      <PixelText text={champion.trainer.nameEs} left={168} top={HALL_BAR.top + 5} width={80} align="right" />
    </div>
  )
}

/** Pantalla de abajo: «TU EQUIPO» y una placa por Pokémon, la primera en verde. */
function VictoryTeam({ data, run }: Pick<Props, 'data' | 'run'>) {
  return (
    <div className="unova-abs unova-screen" style={unovaVars()} aria-hidden="true">
      <img src={uiAsset('party/bg-bottom.png')} alt="" style={{ left: 0, top: 0 }} />
      <span className="unova-bar" style={{ left: 15, top: 6, width: 226, height: 22 }} />
      <span className="unova-text" style={{ left: 24, top: 11 }}>{t.victory.teamTitle}</span>
      {run.team.map((member, i) => (
        <span key={member.species} style={{ left: 1 + (i % 2) * 128, top: 32 + Math.floor(i / 2) * 50, width: PANEL_WIDTH, height: PANEL_HEIGHT }}>
          <img src={uiAsset(`party/panel-${i === 0 ? 'green' : 'blue'}-${i % 2 ? 'right' : 'left'}.png`)} alt="" style={{ left: 0, top: 0 }} />
          <span style={{ left: PANEL.icon.x, top: PANEL.icon.y }}><MemberIcon spriteId={data.dex.species[member.species]?.spriteId ?? member.species} /></span>
          <span className="unova-text" style={{ left: 36, top: 8 }}>{member.nameEs.toUpperCase()}</span>
          <span className="unova-text" style={{ left: 36, top: 24 }}>{`Nv${member.level}`}</span>
        </span>
      ))}
    </div>
  )
}
