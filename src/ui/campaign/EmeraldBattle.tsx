/**
 * Combate de la campaña con la pantalla de Esmeralda (D7, maqueta aprobada el 11/11/2026), con el motor real (worker de campaña,
 * DEC-85) y el presentador del reto diario (`useBattle`). Arriba, battle_bg.c (escenario BUILDING), los dos Pokémon, las cajas de PS
 * (battle_interface.c) y la caja de abajo en sus tres variantes: mensaje, acciones (LUCHAR / MOCHILA / POKéMON / HUIR) y movimientos
 * (con PP y tipo). Abajo, la pantalla de equipo (party_menu.c) para cambiar, con SÍ/NO, y la descripción BAJA de los caídos.
 * MOCHILA y HUIR responden con los textos del juego: no hay objetos en combate ni se huye de un entrenador.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { MoveFx } from '../battle/fx/MoveFx'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { padNumber, textWidth } from '../console/glyphs'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { usePreloadImages } from './usePreloadImages'
import type { BitmapFont } from '../console/theme'
import { esCampaign } from '../../i18n/esCampaign'
import { useBattle } from '../../hooks/useBattle'
import type { LocalCampaignSession } from '../../battle/campaignSession'
import type { BattleSet, EngineEnd } from '../../battle/protocol'
import { calcStats } from '../../core/stats'
import { BattlePanel, SideColumn, useSidePanelOffset } from './CampaignSide'
import { BATTLE_PANEL, sideMons, type SideSets } from './sidePanelsModel'
import { emeraldAbilityName, emeraldItemName } from './emeraldNames'
import type { GameData } from '../../core/types'
import { toId } from '../../core/id'
import { emeraldBattleNames, emeraldMoveName } from './emeraldNames'
import { emeraldLog } from '../../i18n/esEmeraldLog'
import { PartySlot } from './PartySlot'
import { slotBox } from './partySlotModel'
import { EMERALD_INTRO, EMERALD_SWITCH, sessionBattleClient, UNUSED_INIT, type StartBattle } from './campaignBattle'
import { STATUS_ICON, openingFrame, TRANSITION_BARS, TRAINER_SPOT, trainerX, transitionFrame, type PartyMember, activeOf, backSpot, BALL_TINT, barHpAt, barImage, faintDrop, frontSpot, healthbox, hpPauseMs, messagePages, partyFromRequest, ppColor, recallFrame, releaseFrame, sendOutFrame, viewHp, type SendOutState } from './emeraldBattleModel'
import { statAt } from './draftModel'
import { typeIconId } from './movesModel'
import { SummaryPages } from './SummaryPages'
import type { Candidate } from './draftModel'
import { moveSoundIds, playMoveSounds, BATTLE_SFX_IDS, emeraldSfxFor, LOW_HEALTH_PERIOD_MS, LOW_HEALTH_SFX, playCry, playSfx, preloadCries, preloadSfx, useCampaignMusic } from './campaignMusic'
import type { MonView } from '../../battle/protocol'
import moveData from '../../generated/emerald/moves.json'

const t = esCampaign.battle
/** El cursor ▶ sigue al foco y pasar el puntero lleva el foco: un solo ▶ aunque el ratón y el teclado apunten a opciones distintas. */
const focusOnHover = (event: { currentTarget: HTMLElement }) => { event.currentTarget.focus() }
const font = emeraldTheme.font as BitmapFont
const moves = moveData as Record<string, { type: string; category: string }>
/** Columnas de LUCHAR/POKéMON y MOCHILA/HUIR: la segunda en x 188 (la edición inglesa, a 56 px: 192), para que MOCHILA no roce el
    borde derecho (Jose, 11/11/2026); el cursor de HUIR (x 180) aún no pisa POKéMON, que acaba en x 178. */
const ACTION_X = [136, 188] as const
/** «¿Qué hará…?» a la x de los mensajes (16), no a 9: pegado al borde se veía descolocado (Jose, 11/11/2026). */
const PROMPT_X = 16
/**
 * «TIPO/…» en la caja del PP: hasta x 234, donde acaba el blanco. Si no cabe con la fuente normal, la línea entera en la estrecha y, si
 * tampoco (SINIESTRO, ELÉCTRICO), en la pequeña: se salía de la caja (Jose, 12/11/2026).
 */
const TYPE_LINE_WIDTH = 66
const TYPE_FACES = ['normal', 'narrow', 'small'] as const
const typeFace = (line: string) => TYPE_FACES.find((face) => { return TYPE_LINE_WIDTH >= textWidth(font, line, face) }) ?? 'small'

type EmeraldBattleProps = {
  session: LocalCampaignSession
  /** Prepara el combate o reanuda el guardado. */
  start: StartBattle
  data: GameData
  trainer: { nameEs: string; category: 'leader' | 'champion'; gender: 'F' | 'M' }
  /** Sprite del rival (`lider-*`) para la entrada al combate. */
  trainerId?: string
  /** Combate guardado que se retoma: sin entrada, desde donde estaba. */
  resumed?: boolean
  intro: { rivalLead: string; playerLead: string }
  /** Niveles del equipo rival, en su orden (el motor no los da en la vista). */
  rivalLevels: readonly number[]
  /**
   * Nivel de cada especie del jugador: su caja de PS sale de la vista, no de la petición del motor, que llega al acabar de presentar
   * el turno (sin esto, la caja no aparecía al enviarlo en la intro y enseñaba al anterior durante un cambio).
   */
  playerLevels: Readonly<Record<string, number>>
  /** Tema del combate (`battleMusic`): suena desde la intro hasta que acaba. */
  music: string
  /**
   * El equipo con que se entra, para la pantalla de abajo mientras el motor carga (Jose, 12/11/2026: hasta que llegaba la primera
   * petición se veía el equipo vacío).
   */
  lineup?: readonly PartyMember[]
  onEnded: (ended: EngineEnd) => void
  /**
   * Paneles laterales en escritorio (PRD §0, 12/11/2026), como los del reto diario con la ficha del Domo Batalla: los sets con que se juega
   * (del registro del combate, cuando el motor ya lo ha preparado), los tipos de Esmeralda y el nombre del rival.
   */
  sides?: { sets: () => SideSets | null; typesOf: (species: string) => readonly string[]; trainer: string }
  /** Datos de un Pokémon del jugador (especie y cuántos de esa especie van antes en el equipo), para DATOS (Jose, 12/11/2026). */
  summaryOf?: (species: string, occurrence: number) => SummaryData | null
  reservedHeight?: number
  scale?: number
}

type Menu = 'actions' | 'moves' | 'party'
/** Lo que enseña DATOS: la ficha (como en el draft), el nivel y el objeto. */
export type SummaryData = { mon: Candidate; level: number; item: string | null }

export function EmeraldBattle({ session, start, data, trainer, trainerId, resumed = false, summaryOf, intro, rivalLevels, playerLevels, music, lineup = [], onEnded, sides, reservedHeight, scale }: EmeraldBattleProps) {
  const client = useMemo(() => sessionBattleClient(session, start), [session, start])
  const battleNames = useMemo(() => emeraldBattleNames(data.names), [data.names])
  // PS máximos del rival (el motor solo da su porcentaje): los de Gen 3 a su nivel, con 20 IV, sin EV y naturaleza neutra (PRD §0).
  const rivalMaxHp = useMemo(() => (mon: MonView) => {
    const level = rivalLevels[mon.teamIndex ?? 0] ?? 50
    return statAt(data.dex.species[mon.species]?.baseStats.hp ?? 50, level, true)
  }, [data.dex.species, rivalLevels])
  const battle = useBattle({
    client,
    init: UNUSED_INIT,
    translateContext: { names: battleNames, trainer, log: emeraldLog },
    intro,
    onFinish: onEnded,
    introDurations: EMERALD_INTRO,
    skipIntro: resumed,
    switchDurations: EMERALD_SWITCH,
    // La barra de Gen 3 baja 1 PS por fotograma: se espera a que llegue antes del siguiente mensaje.
    hpPause: (before, after) => hpPauseMs(before, after, rivalMaxHp),
    // Efectos de Esmeralda; los de la bola, al ritmo del envío (abajo).
    playSfx: (id) => { const sound = emeraldSfxFor(id); if (sound) playSfx(sound) },
    // Gritos de la tercera generación; al debilitarse, más graves (CRY_MODE_FAINT).
    playCry: (species, faint) => playCry(species, faint),
  })
  useCampaignMusic(battle.introPhase !== 'loading' && !battle.ended ? music : null)
  useEffect(() => preloadSfx(BATTLE_SFX_IDS), [])
  // Sonidos de los ataques: se descargan los de los movimientos de los dos equipos al entrar y suenan con «X usó Y».
  const sideSets = sides?.sets() ?? null
  // Los que pueden salir al campo (frente del rival, espalda propia), sus iconos y la ficha de DATOS, listos antes de cada cambio.
  usePreloadImages(sideSets ? [
    ...sideSets.rival.flatMap((set) => [emeraldSprite('front', set.species), emeraldSprite('icon', set.species)]),
    ...sideSets.player.flatMap((set) => [emeraldSprite('back', set.species), emeraldSprite('front', set.species), emeraldSprite('icon', set.species)]),
  ] : [])
  const movesKey = sideSets ? [...sideSets.player, ...sideSets.rival].flatMap((set) => set.moves).join(',') : ''
  useEffect(() => { if (movesKey) preloadSfx(moveSoundIds(movesKey.split(','))) }, [movesKey])
  const moveFx = battle.moveFx
  const speedRef = useRef(battle.speed)
  // Animaciones de los ataques: las del reto diario (DEC-53), sobre los Pokémon y bajo las cajas (Jose, 13/11/2026: en Esmeralda el
  // atacante no se mueve; se descartaron la embestida y el impacto propios).
  const fieldRef = useRef(null as HTMLDivElement | null)
  useEffect(() => { speedRef.current = battle.speed }, [battle.speed])
  useEffect(() => (moveFx ? playMoveSounds(moveFx.moveId, speedRef.current) : undefined), [moveFx])
  const [menu, setMenu] = useState('actions' as Menu)
  const [moveCursor, setMoveCursor] = useState(0)
  // Menú de un Pokémon del equipo (CAMBIAR / DATOS / CANCELAR) y la ficha que se mira; se pueden abrir en cualquier momento del
  // combate (Jose, 12/11/2026), y CAMBIAR solo vale cuando toca elegir.
  const [memberMenu, setMemberMenu] = useState(null as number | null)
  const [summaryAt, setSummaryAt] = useState(null as number | null)
  const [summaryPage, setSummaryPage] = useState(0)
  const [note, setNote] = useState(null as string | null)
  const [page, setPage] = useState(0)

  const typeLine = (moveId: string) => `${t.type}${(data.names.types[moves[moveId]?.type ?? ''] ?? '').toUpperCase()}`
  const nameOf = (species: string) => (data.names.species[species] ?? species).toUpperCase()
  const view = battle.view
  // Petición ya contestada: hasta que el motor responde, la caja de abajo queda en blanco, como el juego; si no, volvía un instante el
  // menú de acciones con el de movimientos detrás y se podía elegir otra vez.
  const [answered, setAnswered] = useState(null as unknown)
  const request = battle.canAct && battle.request !== answered ? battle.request : null
  const requested = partyFromRequest(battle.request ?? battle.lastChoiceRequest, (i) => toId(((battle.request ?? battle.lastChoiceRequest)?.side.pokemon[i]?.details ?? '').split(',')[0]), nameOf)
  const party = requested.length ? requested : lineup
  const forced = !!request?.forceSwitch?.[0]
  const own = party.find((member) => member.active) ?? null
  const rival = view ? activeOf(view.rival) : null
  const player = view ? activeOf(view.player) : null
  // Envío y retirada (sendOutFrame, recallFrame): antes de que el rival envíe no se ve nadie; el del jugador, desde su envío.
  const beforeSend = ['loading', 'vs', 'iris', 'enter', 'challenge'].includes(battle.introPhase)
  // Entrada (emeraldBattleModel): transición y entrenador rival que entra, habla y sale al enviar.
  const introKey = ['vs', 'iris', 'rivalSend'].includes(battle.introPhase) ? battle.introPhase : null
  const introFrame = useFrames(introKey, battle.speed)
  // Mientras el motor prepara el combate, la pantalla de arriba en negro: la transición empieza desde ahí (se veía el escenario vacío).
  const transition = battle.introPhase === 'loading' ? { white: false, bars: 1 } : battle.introPhase === 'vs' ? transitionFrame(introFrame) : battle.introPhase === 'iris' ? openingFrame(introFrame) : null
  const introTrainer = trainerX(battle.introPhase, introFrame)
  const rivalHidden = beforeSend
  const playerHidden = beforeSend || battle.introPhase === 'rivalSend'
  const switching = (side: 'rival' | 'player') => !!battle.switchAnim?.startsWith(side) && battle.switchStage !== null
  const rivalEvent = battle.introPhase === 'rivalSend' ? 'send:intro'
    : switching('rival') ? `${battle.switchStage}:${view?.rival.active}-${rival?.species}` : null
  const playerEvent = battle.introPhase === 'playerSend' ? 'send:intro'
    : switching('player') ? `${battle.switchStage}:${view?.player.active}-${player?.species}` : null
  useBallSounds(rivalEvent, false, rival?.species ?? '', battle.speed)
  useBallSounds(playerEvent, true, player?.species ?? '', battle.speed)
  const rivalFrame = useFrames(rivalEvent, battle.speed)
  const playerFrame = useFrames(playerEvent, battle.speed)
  const rivalSend = rival && rivalEvent?.startsWith('send') ? sendOutFrame(false, rival.species, rivalFrame) : null
  const playerSend = player && playerEvent?.startsWith('send') ? sendOutFrame(true, player.species, playerFrame) : null
  const rivalRecall = rivalEvent?.startsWith('recall') ? recallFrame(rivalFrame) : null
  const playerRecall = playerEvent?.startsWith('recall') ? recallFrame(playerFrame) : null
  const rivalMotion = rivalSend?.mon ?? rivalRecall ?? null
  const playerMotion = playerSend?.mon ?? playerRecall ?? null
  const rivalHp = rival ? viewHp(rival, rivalMaxHp) : null
  const playerHp = player ? viewHp(player, rivalMaxHp) : null
  const rivalBar = useBarHp(`${view?.rival.active ?? ''}-${rival?.species ?? ''}`, rivalHp?.hp ?? 0, rivalHp?.maxHp ?? 1, battle.speed)
  const playerBar = useBarHp(`${view?.player.active ?? ''}-${player?.species ?? ''}`, playerHp?.hp ?? 0, playerHp?.maxHp ?? 1, battle.speed)
  // Gritos de los Pokémon del combate, como el diario: solo los suyos.
  const teamSpecies = [...(view?.rival.team ?? []), ...(view?.player.team ?? [])].map((mon) => mon.species).join(',')
  useEffect(() => { if (teamSpecies) preloadCries(teamSpecies.split(',')) }, [teamSpecies])
  // Pitido de vida baja (HandleLowHpMusicChange): mientras la barra del jugador está en rojo, encima de la música.
  const lowHealth = !!player && !player.fainted && !!playerHp && !battle.ended && barImage(playerBar / playerHp.maxHp) === 'combate-barra-roja'
  useEffect(() => {
    if (!lowHealth) return
    playSfx(LOW_HEALTH_SFX)
    const timer = setInterval(() => playSfx(LOW_HEALTH_SFX), LOW_HEALTH_PERIOD_MS)
    return () => clearInterval(timer)
  }, [lowHealth])
  const rivalLevel = view?.rival.active != null ? rivalLevels[view.rival.team[view.rival.active]?.teamIndex ?? view.rival.active] ?? 0 : 0
  const requestMoves = request?.active?.[0]?.moves ?? []
  // Como en el diario: cuando se puede actuar, el menú sustituye al último mensaje; un aviso propio (MOCHILA, HUIR) va encima.
  const waiting = battle.canAct && answered !== null && battle.request === answered
  const message = note ?? (request || waiting ? null : battle.message)
  const pages = message ? messagePages(message) : []
  const showing = message !== null || !request
  const box = showing ? 'mensaje' : forced || menu === 'party' ? 'mensaje' : menu === 'moves' ? 'movimientos' : 'acciones'

  const advance = () => {
    if (page + 1 < pages.length) { setPage(page + 1); return }
    setPage(0)
    if (note) { setNote(null); return }
    battle.advance()
  }
  const chooseMove = (i: number) => {
    playSfx('emerald-select')
    setMenu('actions')
    // Con el menú de un Pokémon del equipo abierto (para cambiarlo o mirarlo), elegir ataque lo cierra (Jose, 13/11/2026).
    setMemberMenu(null)
    setAnswered(battle.request)
    battle.choose({ type: 'move', slot: i + 1 })
  }
  const pickMember = (i: number) => {
    if (!party[i]) return
    setMemberMenu(i)
  }
  const canSwitch = (i: number) => !!request && !!party[i] && !party[i].active && !party[i].fainted
  const switchTo = (i: number) => {
    if (party[i]?.fainted) { setMemberMenu(null); setNote(t.cantBattle); return }
    if (!canSwitch(i)) return
    setMemberMenu(null)
    setAnswered(battle.request)
    battle.choose({ type: 'switch', slot: i + 1 })
    setMenu('actions')
  }
  // Datos: el n-ésimo de su especie en la petición es el n-ésimo de esa especie en el equipo.
  const summaryFor = (i: number) => {
    const member = party[i]
    if (!member || !summaryOf) return null
    const occurrence = party.slice(0, i).filter((other) => other.species === member.species).length
    return summaryOf(member.species, occurrence)
  }

  const actions = [
    [t.fight, () => { playSfx('emerald-select'); setMenu('moves') }],
    [t.bag, () => { setNote(t.noBag) }],
    [t.pokemon, () => { setMenu('party') }],
    [t.run, () => { setNote(t.noRun) }],
  ] as const

  const hb = healthbox
  const selectedMove = requestMoves[moveCursor]

  const sideOffset = useSidePanelOffset(reservedHeight ?? 0, BATTLE_PANEL.h)
  const sidePanels = () => {
    const sets = sideOffset === null ? null : sides?.sets() ?? null
    if (!sides || !sets || sideOffset === null) return null
    const statsOf = (set: BattleSet) => {
      const base = data.dex.species[set.species]?.baseStats
      return base ? calcStats(base, set.ivs, set.evs, set.nature, set.level) : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    }
    const names = {
      nameOf, typesOf: sides.typesOf, moveName: (id: string) => emeraldMoveName(id, data.names), moveType: (id: string) => typeIconId(moves[id]?.type ?? 'Normal'),
      itemName: (id: string) => emeraldItemName(id, data.names), abilityName: (id: string) => emeraldAbilityName(id, data.names),
    }
    const rivalTitle = trainer.nameEs.toUpperCase()
    return (
      <>
        <SideColumn side="left" offset={sideOffset} label={esCampaign.side.battleLabel(esCampaign.side.teamLabel)}>
          <BattlePanel title={esCampaign.side.teamTitle} mons={sideMons({ sets: sets.player, side: view?.player ?? null, request: battle.request ?? battle.lastChoiceRequest, statsOf, player: true })}
            boosts={view?.field?.playerActive.boosts ?? null} {...names} />
        </SideColumn>
        <SideColumn side="right" offset={sideOffset} label={esCampaign.side.battleLabel(trainer.nameEs)}>
          <BattlePanel rival={{ trainer: sides.trainer }} title={rivalTitle} mons={sideMons({ sets: sets.rival, side: view?.rival ?? null, statsOf, player: false })}
            boosts={view?.field?.rivalActive.boosts ?? null} {...names} />
        </SideColumn>
      </>
    )
  }
  // Props de la ficha: PS de la petición y, del que está en combate, los PP que le quedan.
  const summaryProps = (summary: SummaryData, member: PartyMember) => {
    const active = member.active ? request?.active?.[0]?.moves ?? battle.lastChoiceRequest?.active?.[0]?.moves ?? null : null
    return {
      mon: summary.mon, level: summary.level, item: summary.item, hp: member.hp,
      pp: active ? summary.mon.moves.map((move) => active.find((entry) => entry.id === move.id)?.pp ?? null) : undefined,
      profile: esCampaign.draft.trainedProfile(summary.level), heading: t.summaryHeading(member.name),
    }
  }

  // Esc vuelve a las acciones desde los movimientos o el equipo (el botón B del juego), salvo en un cambio obligado.
  const onKey = (event: { key: string }) => {
    if (event.key !== 'Escape') return
    if (summaryAt !== null) { setSummaryAt(null); return }
    if (memberMenu !== null) { setMemberMenu(null); return }
    if (forced || menu === 'actions') return
    setMenu('actions')
  }

  return (
    <div className="emerald-battle" onKeyDown={onKey}>
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="field" className="battle-field" ref={fieldRef}>
          <img src={emeraldTheme.asset('combate-escenario')} alt="" style={{ left: 0, top: 0 }} />
          {introTrainer !== null && trainerId && <img src={emeraldTheme.asset(`lider-${trainerId}`)} alt="" style={{ left: introTrainer, top: TRAINER_SPOT.y }} />}
          {rival && (
            // Recorte en el borde de abajo del sprite: al caer se borra por abajo, como SpriteCB_AnimFaintOpponent.
            <div className="mon-clip" style={{ left: frontSpot(rival.species).x, top: 4, width: 64, height: frontSpot(rival.species).y + 60 }}>
              <MonSprite key={`${view?.rival.active}-${rival.species}`} kind="front" species={rival.species} left={0} top={frontSpot(rival.species).y - 4}
                hidden={rivalHidden} motion={rivalMotion} faint={rival.fainted ? faintStyle(false, rival.species, battle.speed) : undefined} />
            </div>
          )}
          {player && (
            <MonSprite key={`${view?.player.active}-${player.species}`} kind="back" species={player.species} left={backSpot(player.species).x} top={backSpot(player.species).y}
              hidden={playerHidden} motion={playerMotion} faint={player.fainted ? faintStyle(true, player.species, battle.speed) : undefined} />
          )}
          {moveFx && (rival || player) && (
            <MoveFx event={moveFx} type={moves[moveFx.moveId]?.type ?? null} speed={battle.speed} fieldRef={fieldRef} width={240} height={160}
              points={{ player: player ? { x: backSpot(player.species).x + 32, y: backSpot(player.species).y + 32 } : { x: 72, y: 80 }, rival: rival ? { x: frontSpot(rival.species).x + 32, y: frontSpot(rival.species).y + 28 } : { x: 172, y: 36 } }}
              spriteSelector={(side) => (side === 'player' ? '.mon-back' : '.mon-front')} />
          )}
          {[rivalSend?.ball, playerSend?.ball].map((ball, i) => {
            if (!ball) return null
            return (
              <div key={i} className="battle-ball" style={{ left: ball.x - 8, top: ball.y - 8, width: 16, height: 16, transform: ball.angle ? `rotate(${ball.angle}deg)` : undefined }}>
                <img src={emeraldTheme.asset('combate-poke-ball')} alt="" style={{ left: 0, top: -16 * ball.frame }} />
              </div>
            )
          })}
          {[...(rivalSend?.particles ?? []), ...(playerSend?.particles ?? [])].map((particle, i) => {
            return (
              <div key={`chispa-${i}`} className="battle-ball" style={{ left: particle.x - 4, top: particle.y - 4, width: 8, height: 8 }}>
                <img src={emeraldTheme.asset('combate-chispas-bola')} alt="" style={{ left: 0, top: -8 * particle.frame }} />
              </div>
            )
          })}
          {rival && (
            <div aria-hidden="true" style={rival.fainted ? hideAfterFaint(false, rival.species, battle.speed) : boxStyle(rivalHidden || !!rivalRecall, rivalSend)}>
              <img src={emeraldTheme.asset(hb(false).image)} alt="" style={{ left: hb(false).left, top: hb(false).top }} />
              <GameText text={nameOf(rival.species)} x={hb(false).name.x} y={hb(false).name.y} face="small" color="combate-nombre" hidden />
              <StatusBadge status={rival.fainted ? null : rival.status} x={hb(false).status.x} y={hb(false).status.y} coverLabel />
              {rivalLevel > 0 && <GameText text={`{LV_2}${rivalLevel}`} x={hb(false).level.x} y={hb(false).level.y} face="small" color="combate-nombre" hidden />}
              <HpBar x={hb(false).bar.x} y={hb(false).bar.y} ratio={rivalHp ? rivalBar / rivalHp.maxHp : 0} />
            </div>
          )}
          {player && playerHp && (
            <div aria-hidden="true" style={player.fainted ? hideAfterFaint(true, player.species, battle.speed) : boxStyle(playerHidden || !!playerRecall, playerSend)}>
              <img src={emeraldTheme.asset(hb(true).image)} alt="" style={{ left: hb(true).left, top: hb(true).top }} />
              <GameText text={nameOf(player.species)} x={hb(true).name.x} y={hb(true).name.y} face="small" color="combate-nombre" hidden />
              <StatusBadge status={player.fainted ? null : player.status} x={hb(true).status.x} y={hb(true).status.y} />
              <GameText text={`{LV_2}${playerLevels[player.species] ?? own?.level ?? ''}`} x={hb(true).level.x} y={hb(true).level.y} face="small" color="combate-nombre" hidden />
              <HpBar x={hb(true).bar.x} y={hb(true).bar.y} ratio={playerBar / playerHp.maxHp} />
              <GameText text={`${padNumber(font, playerBar, 3)}/`} x={hb(true).hp.x} y={hb(true).hp.y} face="small" color="combate-nombre" hidden />
              <GameText text={padNumber(font, playerHp.maxHp, 3)} x={hb(true).max.x} y={hb(true).max.y} face="small" color="combate-nombre" hidden />
            </div>
          )}
          <img src={emeraldTheme.asset(`combate-caja-${box}`)} alt="" style={{ left: 0, top: 112 }} />
          {transition && (
            <div aria-hidden="true" style={{ left: 0, top: 0, width: 240, height: 160, background: transition.white ? '#ffffff' : 'transparent' }}>
              {Array.from({ length: TRANSITION_BARS }, (_, i) => (
                <i key={i} className="battle-transition-bar" style={{ top: i * 20, height: 20, width: Math.ceil(240 * transition.bars), ...(i % 2 ? { right: 0 } : { left: 0 }) }} />
              ))}
            </div>
          )}
          {box === 'mensaje' && (
            <>
              {(pages[page] ?? (forced || menu === 'party' ? [t.choosePokemon] : [])).map((line, i) => (
                <GameText key={i} text={line} x={16} y={121 + 16 * i} color="combate-mensaje" hidden />
              ))}
              {message !== null && (
                <button type="button" className="battle-continue" style={{ left: 0, top: 112, width: 240, height: 48 }} aria-label={t.continueLabel(message)} onClick={advance} />
              )}
            </>
          )}
          {box === 'acciones' && own && (
            <>
              <GameText text={t.whatWill} x={PROMPT_X} y={121} color="combate-mensaje" hidden />
              <GameText text={`${own.name}?`} x={PROMPT_X} y={137} color="combate-mensaje" hidden />
              {actions.map(([label, action], i) => (
                <button key={label} type="button" className="battle-option" style={{ left: ACTION_X[i % 2], top: 120 + 16 * Math.floor(i / 2), width: 48, height: 16 }}
                  aria-label={label} autoFocus={i === 0} onClick={action} onPointerEnter={focusOnHover}>
                  <GameText text={'▶'} x={-8} y={1} color="combate-menu" hidden />
                  <GameText text={label} y={1} color="combate-menu" hidden />
                </button>
              ))}
            </>
          )}
          {box === 'movimientos' && (
            <>
              {requestMoves.map((move, i) => (
                <button key={move.id} type="button" className="battle-option" style={{ left: 16 + 72 * (i % 2), top: 120 + 16 * Math.floor(i / 2), width: 64, height: 16 }}
                  aria-label={t.moveLabel(emeraldMoveName(move.id, data.names), move.pp ?? 0, move.maxpp ?? 0)} disabled={move.disabled || move.pp === 0}
                  autoFocus={i === 0} onClick={() => chooseMove(i)} onFocus={() => setMoveCursor(i)} onPointerEnter={focusOnHover}>
                  <GameText text={'▶'} x={-8} y={1} color="combate-menu" hidden />
                  {/* Fuente estrecha, como el juego (B_WIN_MOVE_NAME_*, FONT_NARROW). */}
                  <GameText text={emeraldMoveName(move.id, data.names)} y={1} width={64} fit face="narrow" color="combate-menu" hidden />
                </button>
              ))}
              {/* Los huecos sin movimiento muestran «-», como el juego. */}
              {Array.from({ length: Math.max(0, 4 - requestMoves.length) }, (_, k) => {
                const i = requestMoves.length + k
                return <GameText key={`vacio-${i}`} text="-" x={16 + 72 * (i % 2)} y={121 + 16 * Math.floor(i / 2)} color="combate-menu" hidden />
              })}
              {selectedMove && (
                <div aria-hidden="true">
                  <GameText text={t.pp} x={168} y={121} color={ppColor(selectedMove.pp ?? 0, selectedMove.maxpp ?? 0)} hidden />
                  <GameText text={`${padNumber(font, selectedMove.pp ?? 0, 2)}/${padNumber(font, selectedMove.maxpp ?? 0, 2)}`} x={202} y={121} color={ppColor(selectedMove.pp ?? 0, selectedMove.maxpp ?? 0)} hidden />
                  <GameText text={typeLine(selectedMove.id)} x={168} y={137} face={typeFace(typeLine(selectedMove.id))} color="combate-menu" hidden />
                </div>
              )}
              <button type="button" className="battle-back" style={{ left: 0, top: 112, width: 8, height: 8 }} aria-label={t.backLabel} onClick={() => setMenu('actions')} />
            </>
          )}
          <p className="sr-only" role="status">{message ?? (box === 'acciones' && own ? t.whatWillLabel(own.name) : forced ? t.choosePokemon : '')}</p>
        </div>
      ), (
        // Llaves: la guarda de literales tomaba el código entre dos JSX por texto.
        (() => { return summaryAt !== null && summaryFor(summaryAt) ? (
          <SummaryPages key="summary" {...summaryProps(summaryFor(summaryAt)!, party[summaryAt])} page={summaryPage} onPage={setSummaryPage} onExit={() => setSummaryAt(null)} />
        ) : (
        <div key="party" className="battle-party">
          <img src={emeraldTheme.asset('equipo-fondo-combate')} alt="" style={{ left: 0, top: 0 }} />
          {Array.from({ length: 6 }, (_, i) => {
            const member = party[i] ?? null
            const r = slotBox(i)
            return (
              <button key={i} type="button" className="team-cell" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                aria-label={member ? t.memberLabel(member.name, member.level, member.hp, member.maxHp, member.fainted, member.active) : t.emptySlot(i + 1)}
                aria-current={member?.active || undefined} disabled={!member}
                onClick={() => pickMember(i)}>
                <PartySlot i={i} mon={member} state={member?.fainted ? (member.active ? 'ko-activa' : 'ko') : member?.active ? 'activa' : 'normal'}
                  bounce={!!member?.active && !member.fainted} description={member?.fainted ? t.fainted : undefined} />
              </button>
            )
          })}
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={memberMenu !== null ? t.doWhat(party[memberMenu]?.name ?? '') : forced || menu === 'party' ? t.choosePokemon : t.yourTeam} y={1} width={168} fit hidden />
          </GameWindow>
          {/* En la lista de movimientos, la misma píldora vuelve a las acciones (Jose, 12/11/2026: no se veía cómo arrepentirse). */}
          {(menu === 'party' && !forced || box === 'movimientos') && memberMenu === null && (
            <button type="button" className="team-button" style={{ left: 184, top: 136, width: 56, height: 16 }} aria-label={box === 'movimientos' ? t.backLabel : t.cancelLabel} onClick={() => { setMenu('actions') }}>
              <GameText text={t.cancel} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
            </button>
          )}
          {memberMenu !== null && party[memberMenu] && (
            <GameWindow x={20} y={11} width={9} height={6}>
              {([[t.switchOption, t.switchLabel(party[memberMenu].name), () => switchTo(memberMenu), !canSwitch(memberMenu) && !party[memberMenu].fainted],
                [t.summaryOption, t.summaryLabel(party[memberMenu].name), () => { setSummaryAt(memberMenu); setSummaryPage(0); setMemberMenu(null) }, !summaryOf],
                [t.cancel, t.closeMenuLabel, () => setMemberMenu(null), false]] as const).map(([label, name, action, off], i) => (
                <button key={label} type="button" className="battle-option" style={{ left: 8, top: i * 16, width: 64, height: 16 }}
                  aria-label={name} aria-disabled={off || undefined} autoFocus={i === 0} onClick={() => { if (!off) action() }} onPointerEnter={focusOnHover}>
                  <GameText text={'▶'} x={-8} y={1} hidden />
                  <GameText text={label} y={1} color={off ? 'ventana-off' : 'ventana'} hidden />
                </button>
              ))}
            </GameWindow>
          )}
        </div>
        ) })()
      )]} />
      {sidePanels()}
    </div>
  )
}

/**
 * Estado alterado en la caja de PS: el icono de 24 x 8 de Esmeralda con las letras de la edición española (`estado-*`, de
 * `status_icons` en la receta del decompilado). La etiqueta de colores con el texto encima se salía de la píldora y pisaba la barra
 * del rival (Jose, 13/11/2026).
 */
export function StatusBadge({ status, x, y, coverLabel = false }: { status: string | null; x: number; y: number; coverLabel?: boolean }) {
  const icon = status ? STATUS_ICON[status] : undefined
  if (!icon) return null
  return (
    <>
      {/* En la caja del rival el icono ocupa el sitio del rótulo PS: se tapa el resto con el fondo de la caja, como el juego. */}
      {coverLabel && <div style={{ left: x + 24, top: y, width: 8, height: 8, background: '#ffffde' }} />}
      <img src={emeraldTheme.asset(`estado-${icon}`)} alt="" style={{ left: x, top: y }} />
    </>
  )
}

/** Barra de PS de la caja (subsprites de 64×8): la parte vacía conserva el marco y se tapa con el gris del juego. */
function HpBar({ x, y, ratio }: { x: number; y: number; ratio: number }) {
  const filled = Math.ceil(48 * Math.max(0, Math.min(1, ratio)))
  return (
    <div style={{ left: x, top: y, width: 64, height: 8 }}>
      <img src={emeraldTheme.asset(barImage(ratio))} alt="" style={{ left: 0, top: 0 }} />
      {filled < 48 && <i className="battle-hp-empty" style={{ left: 16 + filled, top: 3, width: 48 - filled, height: 2 }} />}
    </div>
  )
}

/** Fotogramas de la consola en ms, a la velocidad del combate. */
const frameMs = (frames: number, speed: number) => (frames * 1000) / 60 / speed

/** Caída del Pokémon debilitado (`faintDrop`): a saltos de 8 px el rival, recortado por abajo, y de 5 px el del jugador. */
function faintStyle(player: boolean, species: string, speed: number): CSSProperties {
  const drop = faintDrop(player, species)
  return { ['--faint-to' as string]: `${drop.distance}px`, animation: `emerald-faint ${frameMs(drop.frames, speed)}ms steps(${drop.steps}, end) forwards` }
}

/** La caja de PS del debilitado se oculta cuando su sprite ha caído (HideHealthboxAfterMonFaint, FreeMonSpriteAfterFaintAnim). */
function hideAfterFaint(player: boolean, species: string, speed: number): CSSProperties {
  return { animation: `emerald-hide 1ms linear ${frameMs(faintDrop(player, species).frames, speed)}ms forwards` }
}

/**
 * PS que enseña la barra mientras baja o sube al ritmo de Gen 3 (`barHpAt`, 60 fotogramas por segundo por la velocidad del combate).
 * Con otro Pokémon (`key`) se pone en su valor sin animar.
 */
function useBarHp(key: string, to: number, max: number, speed: number): number {
  const [shown, setShown] = useState({ key, value: to })
  const current = useRef({ key, value: to })
  useEffect(() => {
    const from = current.current.key === key ? current.current.value : to
    current.current = { key, value: from }
    // Sin animación, lo mostrado se pone al día con su clave: si no, al llegar el primer daño la clave guardada era la del montaje y se
    // pintaba un fotograma con los PS finales antes de animar desde los de antes (Jose, 12/11/2026).
    if (from === to) { setShown((previous) => (previous.key === key && previous.value === to ? previous : { key, value: to })); return }
    const started = performance.now()
    let handle = requestAnimationFrame(function tick(now) {
      // La marca de requestAnimationFrame puede ser anterior a `started`: con un fotograma negativo la barra saltaba al valor final y volvía.
      const value = barHpAt(from, to, max, Math.max(0, Math.floor(((now - started) * 60 * speed) / 1000)))
      current.current = { key, value }
      setShown({ key, value })
      if (value !== to) handle = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(handle)
  }, [key, to, max, speed])
  return shown.key === key ? shown.value : to
}

type Motion = { visible: boolean; scale: number; dy?: number; tint: number } | null

/**
 * Sprite del Pokémon en el campo: escala y altura del envío o la retirada (`motion`), con el color de la Poké Ball encima (una capa
 * del color recortada con la forma del sprite) y la caída si está debilitado (`faint`).
 */
function MonSprite({ kind, species, left, top, hidden, motion, faint }: { kind: 'front' | 'back'; species: string; left: number; top: number; hidden: boolean; motion: Motion; faint?: CSSProperties }) {
  const src = emeraldSprite(kind, species)
  const shape: CSSProperties = {
    left, top, width: 64, height: 64,
    visibility: hidden || (motion && !motion.visible) ? 'hidden' : undefined,
    transform: motion && (motion.scale !== 1 || motion.dy) ? `translateY(${motion.dy ?? 0}px) scale(${motion.scale})` : undefined,
  }
  const tinted = !!motion && motion.visible && motion.tint !== 0 && !hidden
  return (
    <>
      <img className={kind === 'front' ? 'mon-front' : 'mon-back'} src={src} alt="" style={{ ...shape, ...faint }} />
      {tinted && (
        <div className="mon-tint" style={{ ...shape, opacity: motion?.tint, background: BALL_TINT, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }} />
      )}
    </>
  )
}

/** Caja de PS: oculta antes del envío o al retirarse, y entrando de lado mientras sale el Pokémon. */
function boxStyle(hidden: boolean, send: SendOutState | null): CSSProperties | undefined {
  if (hidden || (send && send.healthboxDx === null)) return { visibility: 'hidden' }
  return send?.healthboxDx ? { transform: `translateX(${send.healthboxDx}px)` } : undefined
}

/** Fotogramas (60 Hz por la velocidad del combate) desde que empezó `key`; −1 sin animación. */
function useFrames(key: string | null, speed: number): number {
  const [state, setState] = useState({ key, frame: 0 })
  useEffect(() => {
    if (key === null) return
    const started = performance.now()
    let handle = requestAnimationFrame(function tick(now) {
      // La marca de requestAnimationFrame es el inicio del fotograma y puede ser anterior a `started`: sin el mínimo salía el fotograma
      // −1 y el vuelo de la bola (playerBallPath) no tenía posición.
      setState({ key, frame: Math.max(0, Math.floor(((now - started) * 60 * speed) / 1000)) })
      handle = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(handle)
  }, [key, speed])
  if (key === null) return -1
  return state.key === key ? state.frame : 0
}

/** Sonidos de la Poké Ball en el envío: lanzarla (solo la del jugador, que vuela) y abrirse cuando sale el Pokémon. */
function useBallSounds(event: string | null, player: boolean, species: string, speed: number): void {
  useEffect(() => {
    if (!event?.startsWith('send')) return
    if (player) playSfx('emerald-ball-throw')
    const timer = setTimeout(() => playSfx('emerald-ball-open'), frameMs(releaseFrame(player, species), speed))
    return () => clearTimeout(timer)
  }, [event, player, species, speed])
}
