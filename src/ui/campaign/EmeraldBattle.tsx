/**
 * Combate de la campaña con la pantalla de Esmeralda (D7, maqueta aprobada el 11/11/2026), con el motor real (worker de campaña,
 * DEC-85) y el presentador del reto diario (`useBattle`). Arriba, battle_bg.c (escenario BUILDING), los dos Pokémon, las cajas de PS
 * (battle_interface.c) y la caja de abajo en sus tres variantes: mensaje, acciones (LUCHAR / MOCHILA / POKéMON / HUIR) y movimientos
 * (con PP y tipo). Abajo, la pantalla de equipo (party_menu.c) para cambiar, con SÍ/NO, y la descripción BAJA de los caídos.
 * MOCHILA y HUIR responden con los textos del juego: no hay objetos en combate ni se huye de un entrenador.
 */
import { useMemo, useState } from 'react'
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
import { activeOf, backSpot, barImage, frontSpot, healthbox, messagePages, partyFromRequest, ppColor } from './emeraldBattleModel'
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
  onEnded: (ended: EngineEnd) => void
  reservedHeight?: number
  scale?: number
}

type Menu = 'actions' | 'moves' | 'party' | 'confirm'

export function EmeraldBattle({ session, start, data, trainer, intro, rivalLevels, onEnded, reservedHeight, scale }: EmeraldBattleProps) {
  const client = useMemo(() => sessionBattleClient(session, start), [session, start])
  const battleNames = useMemo(() => emeraldBattleNames(data.names), [data.names])
  const battle = useBattle({
    client,
    init: UNUSED_INIT,
    translateContext: { names: battleNames, trainer, log: emeraldLog },
    intro,
    onFinish: onEnded,
    introDurations: EMERALD_INTRO,
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
          {rival && !rival.fainted && (
            <img className="mon-front" src={emeraldSprite('front', rival.species)} alt="" style={{ left: frontSpot(rival.species).x, top: frontSpot(rival.species).y }} />
          )}
          {player && !player.fainted && (
            <img className="mon-back" src={emeraldSprite('back', player.species)} alt="" style={{ left: backSpot(player.species).x, top: backSpot(player.species).y }} />
          )}
          {rival && (
            <div aria-hidden="true">
              <img src={emeraldTheme.asset(hb(false).image)} alt="" style={{ left: hb(false).left, top: hb(false).top }} />
              <GameText text={nameOf(rival.species)} x={hb(false).name.x} y={hb(false).name.y} face="small" color="combate-nombre" hidden />
              {rivalLevel > 0 && <GameText text={`{LV_2}${rivalLevel}`} x={hb(false).level.x} y={hb(false).level.y} face="small" color="combate-nombre" hidden />}
              <HpBar x={hb(false).bar.x} y={hb(false).bar.y} ratio={rival.hpPercent / 100} />
            </div>
          )}
          {own && player && !player.fainted && (
            <div aria-hidden="true">
              <img src={emeraldTheme.asset(hb(true).image)} alt="" style={{ left: hb(true).left, top: hb(true).top }} />
              <GameText text={own.name} x={hb(true).name.x} y={hb(true).name.y} face="small" color="combate-nombre" hidden />
              <GameText text={`{LV_2}${own.level}`} x={hb(true).level.x} y={hb(true).level.y} face="small" color="combate-nombre" hidden />
              <HpBar x={hb(true).bar.x} y={hb(true).bar.y} ratio={own.maxHp ? own.hp / own.maxHp : 0} />
              <GameText text={`${padNumber(font, own.hp, 3)}/`} x={hb(true).hp.x} y={hb(true).hp.y} face="small" color="combate-nombre" hidden />
              <GameText text={padNumber(font, own.maxHp, 3)} x={hb(true).max.x} y={hb(true).max.y} face="small" color="combate-nombre" hidden />
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
