/**
 * Combate de la campaña con la pantalla de Esmeralda (D7, maqueta aprobada el 11/11/2026), con el motor real (worker de campaña,
 * DEC-85) y el presentador del reto diario (`useBattle`). Arriba, battle_bg.c (escenario BUILDING), los dos Pokémon, las cajas de PS
 * (battle_interface.c) y la caja de abajo en sus tres variantes: mensaje, acciones (LUCHAR / MOCHILA / POKéMON / HUIR) y movimientos
 * (con PP y tipo). Abajo, la pantalla de equipo (party_menu.c) para cambiar, con SÍ/NO, y la descripción BAJA de los caídos.
 * MOCHILA y HUIR responden con los textos del juego: no hay objetos en combate ni se huye de un entrenador.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { GameWindow } from '../console/GameWindow'
import { padNumber, textWidth } from '../console/glyphs'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { esCampaign } from '../../i18n/esCampaign'
import { useBattle } from '../../hooks/useBattle'
import type { LocalCampaignSession } from '../../battle/campaignSession'
import type { EngineEnd } from '../../battle/protocol'
import type { GameData } from '../../core/types'
import { toId } from '../../core/id'
import { emeraldBattleNames, emeraldMoveName } from './emeraldNames'
import { emeraldLog } from '../../i18n/esEmeraldLog'
import { PartySlot } from './PartySlot'
import { slotBox } from './partySlotModel'
import { EMERALD_INTRO, sessionBattleClient, UNUSED_INIT, type StartBattle } from './campaignBattle'
import { activeOf, backSpot, BALL_TINT, barHpAt, barImage, faintDrop, frontSpot, healthbox, hpPauseMs, messagePages, partyFromRequest, ppColor, recallFrame, sendOutFrame, viewHp, type SendOutState } from './emeraldBattleModel'
import { statAt } from './draftModel'
import type { MonView } from '../../battle/protocol'
import moveData from '../../generated/emerald/moves.json'

const t = esCampaign.battle
const font = emeraldTheme.font as BitmapFont
const moves = moveData as Record<string, { type: string }>
/** Columnas de LUCHAR/POKéMON y MOCHILA/HUIR: la segunda en x 188 (la edición inglesa, a 56 px: 192), para que MOCHILA no roce el
    borde derecho (Jose, 11/11/2026); el cursor de HUIR (x 180) aún no pisa POKéMON, que acaba en x 178. */
const ACTION_X = [136, 188] as const
/** «¿Qué hará…?» a la x de los mensajes (16), no a 9: pegado al borde se veía descolocado (Jose, 11/11/2026). */
const PROMPT_X = 16

type EmeraldBattleProps = {
  session: LocalCampaignSession
  /** Prepara el combate o reanuda el guardado. */
  start: StartBattle
  data: GameData
  trainer: { nameEs: string; category: 'leader' | 'champion'; gender: 'F' | 'M' }
  intro: { rivalLead: string; playerLead: string }
  /** Niveles del equipo rival, en su orden (el motor no los da en la vista). */
  rivalLevels: readonly number[]
  /**
   * Nivel de cada especie del jugador: su caja de PS sale de la vista, no de la petición del motor, que llega al acabar de presentar
   * el turno (sin esto, la caja no aparecía al enviarlo en la intro y enseñaba al anterior durante un cambio).
   */
  playerLevels: Readonly<Record<string, number>>
  onEnded: (ended: EngineEnd) => void
  reservedHeight?: number
  scale?: number
}

type Menu = 'actions' | 'moves' | 'party' | 'confirm'

export function EmeraldBattle({ session, start, data, trainer, intro, rivalLevels, playerLevels, onEnded, reservedHeight, scale }: EmeraldBattleProps) {
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
    // La barra de Gen 3 baja 1 PS por fotograma: se espera a que llegue antes del siguiente mensaje.
    hpPause: (before, after) => hpPauseMs(before, after, rivalMaxHp),
    playSfx: () => undefined,
    playCry: () => undefined,
  })
  const [menu, setMenu] = useState('actions' as Menu)
  const [moveCursor, setMoveCursor] = useState(0)
  const [target, setTarget] = useState(null as number | null)
  const [note, setNote] = useState(null as string | null)
  const [page, setPage] = useState(0)

  const nameOf = (species: string) => (data.names.species[species] ?? species).toUpperCase()
  const view = battle.view
  const request = battle.canAct ? battle.request : null
  const party = partyFromRequest(battle.request ?? battle.lastChoiceRequest, (i) => toId(((battle.request ?? battle.lastChoiceRequest)?.side.pokemon[i]?.details ?? '').split(',')[0]), nameOf)
  const forced = !!request?.forceSwitch?.[0]
  const own = party.find((member) => member.active) ?? null
  const rival = view ? activeOf(view.rival) : null
  const player = view ? activeOf(view.player) : null
  // Envío y retirada (sendOutFrame, recallFrame): antes de que el rival envíe no se ve nadie; el del jugador, desde su envío.
  const beforeSend = ['loading', 'vs', 'iris', 'enter', 'challenge'].includes(battle.introPhase)
  const rivalHidden = beforeSend
  const playerHidden = beforeSend || battle.introPhase === 'rivalSend'
  const switching = (side: 'rival' | 'player') => !!battle.switchAnim?.startsWith(side) && battle.switchStage !== null
  const rivalEvent = battle.introPhase === 'rivalSend' ? 'send:intro'
    : switching('rival') ? `${battle.switchStage}:${view?.rival.active}-${rival?.species}` : null
  const playerEvent = battle.introPhase === 'playerSend' ? 'send:intro'
    : switching('player') ? `${battle.switchStage}:${view?.player.active}-${player?.species}` : null
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
  const rivalLevel = view?.rival.active != null ? rivalLevels[view.rival.team[view.rival.active]?.teamIndex ?? view.rival.active] ?? 0 : 0
  const requestMoves = request?.active?.[0]?.moves ?? []
  // Como en el diario: cuando se puede actuar, el menú sustituye al último mensaje; un aviso propio (MOCHILA, HUIR) va encima.
  const message = note ?? (request ? null : battle.message)
  const pages = message ? messagePages(message) : []
  const showing = message !== null || !request
  const box = showing ? 'mensaje' : forced || menu === 'party' || menu === 'confirm' ? 'mensaje' : menu === 'moves' ? 'movimientos' : 'acciones'

  const advance = () => {
    if (page + 1 < pages.length) { setPage(page + 1); return }
    setPage(0)
    if (note) { setNote(null); return }
    battle.advance()
  }
  const chooseMove = (i: number) => {
    setMenu('actions')
    battle.choose({ type: 'move', slot: i + 1 })
  }
  const pickMember = (i: number) => {
    if (!request) return
    const member = party[i]
    if (!member || member.active) { if (!forced) setMenu('actions'); return }
    if (member.fainted) { setNote(t.cantBattle); return }
    setTarget(i)
    setMenu('confirm')
  }
  const confirm = (yes: boolean) => {
    if (yes && target !== null) battle.choose({ type: 'switch', slot: target + 1 })
    setTarget(null)
    setMenu('actions')
  }

  const actions = [
    [t.fight, () => { setMenu('moves') }],
    [t.bag, () => { setNote(t.noBag) }],
    [t.pokemon, () => { setMenu('party') }],
    [t.run, () => { setNote(t.noRun) }],
  ] as const

  const hb = healthbox
  const selectedMove = requestMoves[moveCursor]

  return (
    <div className="emerald-battle">
      <ConsoleStage theme={emeraldTheme} scale={scale} reservedHeight={reservedHeight} screens={[(
        <div key="field" className="battle-field">
          <img src={emeraldTheme.asset('combate-escenario')} alt="" style={{ left: 0, top: 0 }} />
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
          {[rivalSend?.ball, playerSend?.ball].map((ball, i) => ball && (
            <div key={i} className="battle-ball" style={{ left: ball.x - 8, top: ball.y - 8, width: 16, height: 16 }}>
              <img src={emeraldTheme.asset('combate-poke-ball')} alt="" style={{ left: 0, top: -16 * ball.frame }} />
            </div>
          ))}
          {rival && (
            <div aria-hidden="true" style={rival.fainted ? hideAfterFaint(false, rival.species, battle.speed) : boxStyle(rivalHidden || !!rivalRecall, rivalSend)}>
              <img src={emeraldTheme.asset(hb(false).image)} alt="" style={{ left: hb(false).left, top: hb(false).top }} />
              <GameText text={nameOf(rival.species)} x={hb(false).name.x} y={hb(false).name.y} face="small" color="combate-nombre" hidden />
              {rivalLevel > 0 && <GameText text={`{LV_2}${rivalLevel}`} x={hb(false).level.x} y={hb(false).level.y} face="small" color="combate-nombre" hidden />}
              <HpBar x={hb(false).bar.x} y={hb(false).bar.y} ratio={rivalHp ? rivalBar / rivalHp.maxHp : 0} />
            </div>
          )}
          {player && playerHp && (
            <div aria-hidden="true" style={player.fainted ? hideAfterFaint(true, player.species, battle.speed) : boxStyle(playerHidden || !!playerRecall, playerSend)}>
              <img src={emeraldTheme.asset(hb(true).image)} alt="" style={{ left: hb(true).left, top: hb(true).top }} />
              <GameText text={nameOf(player.species)} x={hb(true).name.x} y={hb(true).name.y} face="small" color="combate-nombre" hidden />
              <GameText text={`{LV_2}${playerLevels[player.species] ?? own?.level ?? ''}`} x={hb(true).level.x} y={hb(true).level.y} face="small" color="combate-nombre" hidden />
              <HpBar x={hb(true).bar.x} y={hb(true).bar.y} ratio={playerBar / playerHp.maxHp} />
              <GameText text={`${padNumber(font, playerBar, 3)}/`} x={hb(true).hp.x} y={hb(true).hp.y} face="small" color="combate-nombre" hidden />
              <GameText text={padNumber(font, playerHp.maxHp, 3)} x={hb(true).max.x} y={hb(true).max.y} face="small" color="combate-nombre" hidden />
            </div>
          )}
          <img src={emeraldTheme.asset(`combate-caja-${box}`)} alt="" style={{ left: 0, top: 112 }} />
          {box === 'mensaje' && (
            <>
              {(pages[page] ?? (forced || menu === 'party' || menu === 'confirm' ? [t.choosePokemon] : [])).map((line, i) => (
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
                  aria-label={label} autoFocus={i === 0} onClick={action}>
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
                  autoFocus={i === 0} onClick={() => chooseMove(i)} onFocus={() => setMoveCursor(i)} onPointerEnter={() => setMoveCursor(i)}>
                  <GameText text={'▶'} x={-8} y={1} color="combate-menu" hidden />
                  <GameText text={emeraldMoveName(move.id, data.names)} y={1} width={64} fit color="combate-menu" hidden />
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
                  <GameText text={t.type} x={168} y={137} color="combate-menu" hidden />
                  <GameText text={(data.names.types[moves[selectedMove.id]?.type ?? ''] ?? '').toUpperCase()} x={168 + textWidth(font, t.type)} y={137} width={72 - textWidth(font, t.type)} fit color="combate-menu" hidden />
                </div>
              )}
              <button type="button" className="battle-back" style={{ left: 0, top: 112, width: 8, height: 8 }} aria-label={t.backLabel} onClick={() => setMenu('actions')} />
            </>
          )}
          <p className="sr-only" role="status">{message ?? (box === 'acciones' && own ? t.whatWillLabel(own.name) : forced ? t.choosePokemon : '')}</p>
        </div>
      ), (
        <div key="party" className="battle-party">
          <img src={emeraldTheme.asset('equipo-fondo-combate')} alt="" style={{ left: 0, top: 0 }} />
          {Array.from({ length: 6 }, (_, i) => {
            const member = party[i] ?? null
            const r = slotBox(i)
            return (
              <button key={i} type="button" className="team-cell" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                aria-label={member ? t.memberLabel(member.name, member.level, member.hp, member.maxHp, member.fainted, member.active) : t.emptySlot(i + 1)}
                aria-current={member?.active || undefined} disabled={!request || (!forced && menu !== 'party' && menu !== 'confirm')}
                onClick={() => pickMember(i)}>
                <PartySlot i={i} mon={member} state={member?.fainted ? (member.active ? 'ko-activa' : 'ko') : member?.active ? 'activa' : 'normal'}
                  bounce={!!member?.active && !member.fainted} description={member?.fainted ? t.fainted : undefined} />
              </button>
            )
          })}
          <GameWindow x={1} y={17} width={21} height={2}>
            <GameText text={menu === 'confirm' && target !== null ? t.switchTo(party[target]?.name ?? '') : t.choosePokemon} y={1} width={168} fit hidden />
          </GameWindow>
          {(menu === 'party' || menu === 'confirm') && !forced && (
            <button type="button" className="team-button" style={{ left: 184, top: 136, width: 56, height: 16 }} aria-label={t.cancelLabel} onClick={() => { setTarget(null); setMenu('actions') }}>
              <GameText text={t.cancel} x={5} y={1} width={48} align="center" face="small" color="equipo" hidden />
            </button>
          )}
          {menu === 'confirm' && target !== null && (
            <GameWindow x={24} y={12} width={5} height={4}>
              {([[t.yes, true], [t.no, false]] as const).map(([label, yes], i) => (
                <button key={label} type="button" className="battle-option" style={{ left: 8, top: i * 16, width: 32, height: 16 }}
                  aria-label={yes ? t.yesLabel : t.noLabel} autoFocus={i === 0} onClick={() => confirm(yes)}>
                  <GameText text={'▶'} x={-8} y={1} hidden />
                  <GameText text={label} y={1} hidden />
                </button>
              ))}
            </GameWindow>
          )}
        </div>
      )]} />
    </div>
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
    if (from === to) return
    const started = performance.now()
    let handle = requestAnimationFrame(function tick(now) {
      const value = barHpAt(from, to, max, Math.floor(((now - started) * 60 * speed) / 1000))
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
  return (
    <>
      <img className={kind === 'front' ? 'mon-front' : 'mon-back'} src={src} alt="" style={{ ...shape, ...faint }} />
      {motion && motion.visible && motion.tint > 0 && !hidden && (
        <div className="mon-tint" style={{ ...shape, opacity: motion.tint, background: BALL_TINT, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }} />
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
      setState({ key, frame: Math.floor(((now - started) * 60 * speed) / 1000) })
      handle = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(handle)
  }, [key, speed])
  if (key === null) return -1
  return state.key === key ? state.frame : 0
}
