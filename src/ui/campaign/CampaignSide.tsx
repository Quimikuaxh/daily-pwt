/**
 * Paneles laterales de la campaña en escritorio (PRD §0, 12/11/2026; maquetas `maquetas.html?v=paneles` y `?v=paneles-combate`), con la
 * estética de Esmeralda: «Tu campaña» como la Ficha de Entrenador (trainer_card.c: franjas verdes, borde azul y las medallas en sus
 * huecos), «Tu equipo» como la pantalla de equipo (party_menu.c: fondo oliva y placas, con el objeto en un recuadro) y, en el combate,
 * uno por bando como la ficha del Domo Batalla (battle_dome.c: borde verde azulado y franjas verdes). Se colocan a los lados de la consola
 * (sidePanelOffset) y no cambian su escala.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ConsoleStage } from '../console/ConsoleStage'
import { GameText } from '../console/GameText'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import type { Boosts } from '../../battle/fieldState'
import type { StatsTable } from '../../core/types'
import { PartySlot } from './PartySlot'
import { hpBarColors } from './partySlotModel'
import { BATTLE_PANEL, CAMPAIGN_PANEL, PANEL_SCALE, sidePanelOffset, STATUS_SHORT, stageText, type SideMon } from './sidePanelsModel'

const t = esCampaign.side
const stripes = (a: string, b: string): CSSProperties => ({ background: `repeating-linear-gradient(${a} 0 2px, ${b} 2px 4px)` })
const campaignTheme = { ...emeraldTheme, screen: CAMPAIGN_PANEL, screens: 1 }
const battleTheme = { ...emeraldTheme, screen: BATTLE_PANEL, screens: 1 }

/** Columna de un lado de la consola: `offset` es la distancia del centro de la página a su borde interior. */
export function SideColumn({ side, offset, label, children }: { side: 'left' | 'right'; offset: number; label: string; children: ReactNode }) {
  const style = side === 'left' ? { right: `calc(50% + ${offset}px)` } : { left: `calc(50% + ${offset}px)` }
  return <section className="campaign-side" style={style} aria-label={label}>{children}</section>
}

type CardProps = { points: number; minutes: number; fainted: number; species: number; box: number; next: string; badges: number }

/** «Tu campaña» como la Ficha de Entrenador. */
export function CampaignCard({ points, minutes, fainted, species, box, next, badges }: CardProps) {
  const rows: [string, string][] = [
    [t.points, esCampaign.result.points(points)], [t.time, esCampaign.result.clock(minutes)], [t.fainted, String(fainted)],
    [t.species, String(species)], [t.box, String(box)], [t.next, next],
  ]
  // Bloque con llaves: la guarda de literales (literals.test.ts) tomaba el código entre dos JSX por texto.
  const card = (() => { return (
    <div key="card" style={{ inset: 0, ...stripes('#6ab4d5', '#297ba4') }}>
      <div style={{ left: 4, top: 4, width: 176, height: 288, borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 0 1px #626273', ...stripes('#ffffff', '#e6ffde') }}>
        <div style={{ left: 0, top: 0, width: 176, height: 26, ...stripes('#94ee83', '#83de73') }} />
        <div style={{ left: 10, top: 6, width: 96, height: 14, background: '#6abdff', boxShadow: '0 0 0 1px #418bc5' }} />
        <GameText text={t.campaignTitle} x={16} y={6} color="datos" hidden />
        {rows.map(([label, value], i) => (
          <span key={label}>
            <div style={{ left: 6, top: 38 + i * 26, width: 3, height: 8, background: '#94ee83' }} />
            <GameText text={label} x={14} y={34 + i * 26} face="small" color="ventana" hidden />
            <GameText text={value} x={14} y={44 + i * 26} width={156} align="right" color="datos" fit hidden />
            <div style={{ left: 14, top: 58 + i * 26, width: 156, height: 1, background: '#a4a4a4' }} />
          </span>
        ))}
        <div style={{ left: 0, top: 192, width: 176, height: 96, ...stripes('#94ee83', '#83de73') }} />
        <GameText text={t.medals} x={10} y={196} face="small" color="blanco" hidden />
        {Array.from({ length: 8 }, (_, i) => {
          const x = 12 + (i % 4) * 40
          const y = 212 + Math.floor(i / 4) * 34
          return (
            <span key={i}>
              <div style={{ left: x, top: y, width: 30, height: 28, boxShadow: 'inset 0 0 0 1px #ffffff' }} />
              <img src={emeraldTheme.asset(`medalla-${i + 1}`)} alt="" className={i < badges ? undefined : 'campaign-side-medal-off'} style={{ left: x + 7, top: y + 6 }} />
            </span>
          )
        })}
      </div>
    </div>
  ) })()
  return (
    <>
      {/* Lo pintado va en lienzos; para los lectores de pantalla, la misma ficha en texto. */}
      <dl className="visually-hidden">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        <div><dt>{t.medals}</dt><dd>{t.badgesValue(badges)}</dd></div>
      </dl>
      <ConsoleStage theme={campaignTheme} scale={PANEL_SCALE} screens={[card]} />
    </>
  )
}

export type TeamPanelMon = { species: string; name: string; level: number; hp: number; maxHp: number; item: string | null }

/** «Tu equipo» como la pantalla de equipo: seis placas (las vacías, sin Pokémon) y el objeto de cada uno en su recuadro. */
/** Icono de la caja del panel (con su estado: los caídos, en gris). */
export type BoxPanelMon = { species: string; name: string; fainted: boolean }
const BOX_PER_ROW = 5
const BOX_ROWS = 2

/**
 * «Tu equipo» como la pantalla de equipo: seis placas (las vacías, sin Pokémon) con el objeto de cada uno en su recuadro y, debajo, la CAJA
 * con los iconos de los que no van en el equipo (Jose, 12/11/2026: en el draft no se veía qué se tenía); los caídos, en gris.
 */
export function TeamPanel({ party, box = [], limit = party.length, itemName }: { party: readonly (TeamPanelMon | null)[]; box?: readonly BoxPanelMon[]; limit?: number; itemName: (id: string) => string }) {
  const count = party.filter(Boolean).length
  const shownBox = box.slice(0, BOX_PER_ROW * BOX_ROWS)
  const hiddenBox = box.length - shownBox.length
  // Bloque con llaves: la guarda de literales (literals.test.ts) tomaba el código entre dos JSX por texto.
  const screen = (() => { return (
    <div key="team" style={{ inset: 0, ...stripes('#cdd57b', '#b4b45a'), boxShadow: 'inset 0 0 0 4px #8b9c29' }}>
      <div className="game-window" style={{ left: 0, top: 0, width: 96, height: 32 }} />
      <GameText text={t.teamTitle} x={8} y={8} hidden />
      <GameText text={t.teamCount(count, limit)} x={96} y={14} width={80} align="right" face="small" color="equipo" hidden />
      {party.map((mon, i) => {
        // Placas a 28 px, como la pantalla de equipo (24 + 4): deja sitio a la caja debajo.
        const top = 34 + i * 28
        return (
          <span key={i}>
            <div style={{ left: 6, top, width: 144, height: 24 }}>
              <PartySlot i={1} mon={mon} state="normal" />
            </div>
            {mon && <div style={{ left: 153, top: top - 1, width: 26, height: 26, borderRadius: 4, background: '#ffffff', boxShadow: 'inset 0 0 0 1px #4a4a62' }} />}
            {mon?.item && <img src={emeraldTheme.asset(`objeto-${mon.item}`)} alt="" style={{ left: 154, top }} />}
          </span>
        )
      })}
      <div className="game-window" style={{ left: 4, top: 206, width: 176, height: 86 }} />
      <GameText text={t.box} x={12} y={212} face="small" hidden />
      {hiddenBox > 0 && <GameText text={t.boxMore(hiddenBox)} x={100} y={212} width={72} align="right" face="small" hidden />}
      {shownBox.map((mon, i) => (
        <img key={i} className={mon.fainted ? 'mon-icon campaign-side-fainted' : 'mon-icon mon-icon-anim'} src={emeraldSprite('icon', mon.species)} alt=""
          style={{ left: 8 + (i % BOX_PER_ROW) * 34, top: 222 + Math.floor(i / BOX_PER_ROW) * 32 }} />
      ))}
    </div>
  ) })()
  return (
    <>
      <ul className="visually-hidden">
        {party.flatMap((mon) => (mon ? [mon] : [])).map((mon, i) => <li key={i}>{t.teamMonLabel(mon.name, mon.level, mon.item ? itemName(mon.item) : null)}</li>)}
        {box.length > 0 && <li>{t.boxLabel(box.map((mon) => (mon.fainted ? t.faintedName(mon.name) : mon.name)).join(', '))}</li>}
      </ul>
      <ConsoleStage theme={campaignTheme} scale={PANEL_SCALE} screens={[screen]} />
    </>
  )
}

const DOMO = { bg: '#20738b', band: '#6aa48b', box: '#deeede', line: '#83c58b' }
const STAT_ORDER: readonly (keyof StatsTable)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']

/** Caja de la ficha: franja verde con su rótulo y fondo claro; `x`, `y`, `w`, `h`, el hueco de dentro. */
function DomeBox({ x, y, w, h, label, clip = false, children }: { x: number; y: number; w: number; h: number; label: string; clip?: boolean; children: ReactNode }) {
  return (
    <div style={{ left: x - 4, top: y - 4, width: w + 8, height: h + 8, overflow: clip ? 'hidden' : undefined, background: DOMO.box, borderRadius: 4, boxShadow: `inset 0 0 0 1px ${DOMO.bg}` }}>
      <div style={{ left: 0, top: 0, width: w + 8, height: 11, background: DOMO.line, borderRadius: '4px 4px 0 0' }} />
      <GameText text={label} x={4} y={0} face="small" color="domo" hidden />
      <div style={{ left: 4, top: 4, width: w, height: h }}>{children}</div>
    </div>
  )
}

type BattlePanelProps = {
  title: string
  mons: readonly SideMon[]
  boosts: Boosts | null
  /**
   * Rival (Jose, 12/11/2026: «es mejor no saber lo que tienen»): su sprite (`lider-*`), sus Pokémon, la habilidad y los ataques de cada
   * uno, pero ni estadísticas ni objeto. Sin él, el panel del jugador, con todo.
   */
  rival?: { trainer: string } | null
  nameOf: (species: string) => string
  typesOf: (species: string) => readonly string[]
  moveName: (id: string) => string
  moveType: (id: string) => string
  itemName: (id: string) => string
  abilityName: (id: string) => string
}

/** Icono de un Pokémon con su barra de PS, que se pulsa para ver su ficha. */
function MonButton({ mon, x, y, label, onPick }: { mon: SideMon; x: number; y: number; label: string; onPick: () => void }) {
  const ratio = mon.maxHp ? mon.hp / mon.maxHp : 0
  return (
    <button type="button" style={{ left: x, top: y, width: 32, height: 38 }} aria-label={label} onClick={onPick}>
      <img className={mon.fainted ? 'mon-icon campaign-side-fainted' : 'mon-icon mon-icon-anim'} src={emeraldSprite('icon', mon.species)} alt="" style={{ left: 0, top: 0 }} />
      <i className="party-hp-bar" style={{ left: 0, top: 34, width: Math.ceil(32 * ratio), background: hpBarColors(ratio)[0] }} />
    </button>
  )
}

/**
 * Panel de un bando en el combate: Poké Balls de los que siguen en pie, la ficha del elegido (el que está en combate, salvo que se pulse
 * otro) y los demás con su barra de PS. Si sale otro al campo, vuelve al que está en combate, como el del reto diario.
 */
export function BattlePanel({ title, mons, boosts, rival = null, nameOf, typesOf, moveName, moveType, itemName, abilityName }: BattlePanelProps) {
  const activeIndex = mons.find((mon) => mon.active)?.index ?? null
  const [picked, setPicked] = useState({ forActive: activeIndex, index: null as number | null })
  const current = picked.forActive === activeIndex ? picked.index : null
  const shown = mons.find((mon) => mon.index === (current ?? activeIndex)) ?? mons.find((mon) => !mon.fainted) ?? mons[0]
  if (!shown) return null
  const pick = (index: number) => { setPicked({ forActive: activeIndex, index }) }
  const ratio = shown.maxHp ? shown.hp / shown.maxHp : 0
  const [dark, light] = hpBarColors(ratio)
  const hpText = shown.percentOnly ? t.percent(shown.hp) : `${shown.hp}/${shown.maxHp}`
  const status = shown.fainted ? esCampaign.battle.fainted : shown.status ? STATUS_SHORT[shown.status] ?? '' : ''
  const statBoosts = shown.active ? boosts : null
  // El rival lleva arriba su sprite y su equipo; debajo, lo mismo que el jugador sin estadísticas ni objeto.
  const top = rival ? 116 : 32
  const movesTop = rival ? 208 : 184
  // Bloque con llaves: la guarda de literales (literals.test.ts) tomaba el código entre dos JSX por texto.
  const screen = (() => { return (
    <div key="panel" style={{ inset: 0, background: DOMO.bg }}>
      <div style={{ left: 0, top: 0, width: 184, height: 20, background: DOMO.band }} />
      <GameText text={title} x={8} y={3} width={104} color="blanco" fit hidden />
      {mons.map((mon, i) => <img key={mon.index} src={emeraldTheme.asset(mon.fainted ? 'bola-1' : 'bola-0')} alt="" style={{ left: 120 + i * 9, top: 6 }} />)}
      {rival && (
        <DomeBox x={8} y={32} w={168} h={72} label={t.rivalTeam} clip>
          {/* Debajo de la franja del rótulo (que acaba 7 px dentro) y recortado por la caja: el sprite mide 64 x 64. */}
          <img src={emeraldTheme.asset(`lider-${rival.trainer}`)} alt="" style={{ left: -4, top: 8 }} />
          {mons.map((mon, i) => <MonButton key={mon.index} mon={mon} x={64 + (i % 3) * 34} y={10 + Math.floor(i / 3) * 30} label={t.showMon(nameOf(mon.species))} onPick={() => { pick(mon.index) }} />)}
        </DomeBox>
      )}
      <DomeBox x={8} y={top} w={168} h={40} label={shown.active ? t.inBattle : t.onBench}>
        <img className={shown.fainted ? 'mon-icon campaign-side-fainted' : 'mon-icon mon-icon-anim'} src={emeraldSprite('icon', shown.species)} alt="" style={{ left: -4, top: 2 }} />
        <GameText text={nameOf(shown.species)} x={28} y={8} width={96} color="datos" fit hidden />
        <GameText text={`Nv${shown.level}`} x={130} y={8} width={38} align="right" color="datos" hidden />
        {typesOf(shown.species).map((type, i) => <img key={type} src={emeraldTheme.asset(`tipo-${type}`)} alt="" style={{ left: 28 + 34 * i, top: 24 }} />)}
        <i className="party-hp-bar" style={{ left: 98, top: 30, width: Math.ceil(30 * ratio), background: `linear-gradient(${dark} 0 1px, ${light} 1px)` }} />
        <GameText text={status} x={98} y={14} width={30} face="small" color={shown.fainted ? 'pc-hembra' : 'datos'} hidden />
        <GameText text={hpText} x={128} y={24} width={40} align="right" face="small" color="datos" hidden />
      </DomeBox>
      {!rival && (
        <DomeBox x={8} y={88} w={168} h={40} label={t.stats}>
          {STAT_ORDER.map((stat, i) => {
            const x = (i % 2) * 88
            const y = 8 + Math.floor(i / 2) * 11
            const stage = stageText(statBoosts, stat)
            return (
              <span key={stat}>
                <GameText text={t.statNames[stat]} x={x} y={y} face="small" color="datos" hidden />
                <GameText text={String(shown.stats[stat])} x={x + 46} y={y} width={26} align="right" face="small" color="datos" hidden />
                {stage && <GameText text={stage} x={x + 73} y={y} face="small" color={stage.startsWith('+') ? 'pc-macho' : 'pc-hembra'} hidden />}
              </span>
            )
          })}
        </DomeBox>
      )}
      {rival ? (
        <DomeBox x={8} y={172} w={168} h={20} label={t.ability}>
          <GameText text={abilityName(shown.ability)} x={0} y={8} width={168} face="small" color="datos" fit hidden />
        </DomeBox>
      ) : (
        <DomeBox x={8} y={144} w={168} h={24} label={t.itemAbility}>
          <GameText text={shown.item ? itemName(shown.item) : t.noItem} x={0} y={9} width={84} face="small" color="datos" fit hidden />
          <GameText text={abilityName(shown.ability)} x={88} y={9} width={80} face="small" color="datos" fit hidden />
        </DomeBox>
      )}
      <DomeBox x={8} y={movesTop} w={168} h={72} label={t.moves}>
        {shown.moves.map((move, i) => (
          <span key={move.id + i}>
            <img src={emeraldTheme.asset(`tipo-${moveType(move.id)}`)} alt="" style={{ left: 0, top: 8 + i * 16 }} />
            <GameText text={moveName(move.id)} x={36} y={10 + i * 16} width={90} face="small" color="datos" fit hidden />
            {move.pp !== null && <GameText text={`${move.pp}/${move.maxPp}`} x={128} y={10 + i * 16} width={40} align="right" face="small" color="datos" hidden />}
          </span>
        ))}
      </DomeBox>
      {!rival && mons.filter((mon) => mon.index !== shown.index).map((mon, i) => (
        <MonButton key={mon.index} mon={mon} x={8 + i * 34} y={266} label={t.showMon(nameOf(mon.species))} onPick={() => { pick(mon.index) }} />
      ))}
    </div>
  ) })()
  return (
    <>
      {/* Lo pintado va en lienzos; para los lectores de pantalla, la ficha en texto (con lo mismo que se ve: del rival, sin estadísticas ni objeto). */}
      <dl className="visually-hidden">
        <div><dt>{t.shownLabel}</dt><dd>{t.monSummary(nameOf(shown.species), shown.level, hpText, status, shown.active)}</dd></div>
        {!rival && <div><dt>{t.stats}</dt><dd>{STAT_ORDER.map((stat) => `${t.statNames[stat]} ${shown.stats[stat]}${stageText(statBoosts, stat)}`).join(', ')}</dd></div>}
        {!rival && <div><dt>{t.item}</dt><dd>{shown.item ? itemName(shown.item) : t.noItem}</dd></div>}
        <div><dt>{t.ability}</dt><dd>{abilityName(shown.ability)}</dd></div>
        <div><dt>{t.moves}</dt><dd>{shown.moves.map((move) => moveName(move.id)).join(', ')}</dd></div>
      </dl>
      <ConsoleStage theme={battleTheme} scale={PANEL_SCALE} screens={[screen]} />
    </>
  )
}

/** Distancia de los paneles al centro mientras caben a los lados de la consola (sidePanelOffset); null si no caben. */
export function useSidePanelOffset(reservedHeight: number, panelHeight: number): number | null {
  const read = () => sidePanelOffset(document.documentElement.clientWidth, window.innerHeight, reservedHeight, panelHeight)
  const [offset, setOffset] = useState(read)
  useEffect(() => {
    const update = () => { setOffset(sidePanelOffset(document.documentElement.clientWidth, window.innerHeight, reservedHeight, panelHeight)) }
    update()
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('resize', update) }
  }, [reservedHeight, panelHeight])
  return offset
}
