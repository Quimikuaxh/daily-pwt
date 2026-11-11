/**
 * Hueco de la pantalla de equipo de Esmeralda (party_menu.c), compartido por Equipo y PC y por el equipo del Combate: placa
 * (`equipo-hueco-*`), icono animado, nombre, nivel, PS y barra en los rectángulos de sPartyBoxInfoRects. El principal va en (8,24) y
 * mide 80 x 56; los anchos, en (96, 8 + 24·(i − 1)) y miden 144 x 24. Solo pinta: el botón y su nombre accesible los pone quien lo usa.
 */
import { GameText } from '../console/GameText'
import { padNumber } from '../console/glyphs'
import { emeraldSprite, emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { hpBarColors, slotImage, slotRect, type SlotState } from './partySlotModel'

export type SlotMon = { species: string; name: string; level: number; hp: number; maxHp: number }

type PartySlotProps = {
  i: number
  mon: SlotMon | null
  state: SlotState
  /** El Pokémon está en la mano (se ve la placa vacía de debajo). */
  held?: boolean
  /** Seleccionado: su icono rebota con la animación (SpriteCB_BouncePartyMonIcon: −3 px con el fotograma 1 y +1 con el 0). */
  bounce?: boolean
  /** Texto en lugar de los PS (sDescriptionStringTable), con la placa sin PS: «BAJA» en los caídos. */
  description?: string
}

export function PartySlot({ i, mon, state, held = false, bounce = false, description }: PartySlotProps) {
  const r = slotRect(i)
  const font = emeraldTheme.font as BitmapFont
  const ratio = mon ? mon.hp / mon.maxHp : 0
  const [dark, light] = hpBarColors(ratio)
  return (
    <>
      <img src={emeraldTheme.asset(slotImage(i, !!mon, state, !!(mon && description)))} alt="" style={{ left: 0, top: 0 }} />
      {mon && description && !held && (
        <>
          <img className="mon-icon" src={emeraldSprite('icon', mon.species)} alt="" style={{ left: -8, top: r.icon }} />
          <GameText text={mon.name} x={r.name[0]} y={r.name[1]} width={40} face="small" color="equipo" hidden />
          <GameText text={`{LV}${mon.level}`} x={r.lv[0]} y={r.lv[1]} face="small" color="equipo" hidden />
          <GameText text={description} x={r.desc[0]} y={r.desc[1]} width={64} color="equipo" hidden />
        </>
      )}
      {mon && !description && !held && (
        <>
          <img className={!mon.hp ? 'mon-icon' : bounce ? 'mon-icon mon-icon-anim mon-icon-bounce' : 'mon-icon mon-icon-anim'} src={emeraldSprite('icon', mon.species)} alt="" style={{ left: -8, top: r.icon }} />
          <GameText text={mon.name} x={r.name[0]} y={r.name[1]} width={40} face="small" color="equipo" hidden />
          <GameText text={`{LV}${mon.level}`} x={r.lv[0]} y={r.lv[1]} face="small" color="equipo" hidden />
          <GameText text={padNumber(font, mon.hp, 3)} x={r.hp[0]} y={r.hp[1]} face="small" color="equipo" hidden />
          <GameText text={`/${padNumber(font, mon.maxHp, 3)}`} x={r.max[0]} y={r.max[1]} face="small" color="equipo" hidden />
          <i className="party-hp-bar" style={{ left: r.bar[0], top: r.bar[1], width: Math.ceil(48 * ratio), background: `linear-gradient(${dark} 0 1px, ${light} 1px)` }} />
        </>
      )}
    </>
  )
}
