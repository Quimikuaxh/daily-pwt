/**
 * Modelo de la pantalla de combate de Esmeralda (D7, maqueta aprobada el 11/11/2026): equipo del jugador desde la petición del motor,
 * geometría de las cajas de PS (battle_interface.c: centros (158,88) del jugador y (44,30) del rival) y de los sprites
 * (battle_anim_mons.c: centros (72,80) y (176,40) con el desplazamiento vertical de cada especie), y mensajes en las dos líneas del juego.
 */
import type { BattleRequest, MonView } from '../../battle/protocol'
import emeraldSprites from '../../generated/emerald/sprites.json'
import { textWidth } from '../console/glyphs'
import { emeraldTheme } from '../console/themes/emerald'
import type { BitmapFont } from '../console/theme'
import { wrapText } from './draftModel'

const sprites = emeraldSprites as Record<string, { backY: number; frontY: number; dex: number }>
const font = emeraldTheme.font as BitmapFont

export type PartyMember = { species: string; name: string; level: number; hp: number; maxHp: number; fainted: boolean; active: boolean }

/** `"45/120 par"` o `"0 fnt"` → PS actuales y máximos. */
export function parseCondition(condition: string): { hp: number; maxHp: number; fainted: boolean } {
  const [hpPart, status] = condition.split(' ')
  const [hp, max] = hpPart.split('/').map(Number)
  return { hp: hp || 0, maxHp: max || hp || 0, fainted: status === 'fnt' || hp === 0 }
}

/** `"Grovyle, L19, M"` → nivel. */
export const levelOf = (details: string): number => Number(/, L(\d+)/.exec(details)?.[1] ?? 100)

/** Equipo del jugador en el orden del motor, con los nombres en mayúsculas de Esmeralda. */
export function partyFromRequest(request: BattleRequest | null, speciesOf: (index: number) => string, nameOf: (species: string) => string): PartyMember[] {
  return (request?.side.pokemon ?? []).map((pokemon, i) => {
    const species = speciesOf(i)
    return { species, name: nameOf(species).toUpperCase(), level: levelOf(pokemon.details), ...parseCondition(pokemon.condition), active: pokemon.active }
  })
}

/** Esquina superior izquierda de los sprites en la pantalla de arriba. */
/** El rival, 4 px a la izquierda y 4 arriba del centro (176,40) del juego: con este escenario quedaba desplazado sobre su plataforma
    (Jose, 11/11/2026). */
export const frontSpot = (species: string) => ({ x: 140, y: 4 + (sprites[species]?.frontY ?? 0) })
export const backSpot = (species: string) => ({ x: 40, y: 48 + (sprites[species]?.backY ?? 0) })

/** Caja de PS: imagen, textos y barra (SpriteCB_HealthBar: +16 en el jugador y +8 en el rival, en subsprites de 32×8). */
export function healthbox(player: boolean) {
  const x = player ? 158 : 44
  const y = player ? 88 : 30
  const left = x - 32
  const top = y - 16
  return {
    image: player ? 'combate-ps-player' : 'combate-ps-opponent',
    left, top,
    name: { x: left + (player ? 16 : 8), y: top + 3 },
    level: { x: left + (player ? 77 : 69), y: top + 3 },
    bar: { x: x + (player ? 16 : 8) - 16, y },
    // PS 2 px más arriba que en la maqueta (y + 19): pegados al borde inferior de la caja (Jose, 11/11/2026).
    hp: { x: left + 60, y: top + 19 },
    max: { x: left + 80, y: top + 19 },
  }
}

/** Barra de PS por proporción: verde, amarilla por debajo de la mitad y roja por debajo de un quinto. */
export const barImage = (ratio: number): string => ratio <= 0.2 ? 'combate-barra-roja' : ratio <= 0.5 ? 'combate-barra-amarilla' : 'combate-barra'

/** Mensaje en las dos líneas de la caja (208 px desde x 16); si no cabe, en varias pantallas de dos líneas. */
export function messagePages(message: string): string[][] {
  const lines = wrapText(message, 208, (line) => textWidth(font, line))
  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2))
  return pages
}

/** El activo del rival, para su sprite y su caja. */
export const activeOf = (side: { active: number | null; team: MonView[] }): MonView | null => side.active === null ? null : side.team[side.active] ?? null

/** Color de los PP en el menú de movimientos (GetCurrentPPToMaxPPState de battle_message.c). */
export function ppColor(current: number, max: number): 'pp-0' | 'pp-1' | 'pp-2' | 'pp-3' {
  if (max === current) return 'pp-3'
  if (max <= 7) return current > (max <= 2 ? 1 : 2) ? 'pp-3' : (`pp-${2 - current}` as 'pp-1' | 'pp-2')
  if (current === 0) return 'pp-2'
  if (current <= Math.floor(max / 4)) return 'pp-1'
  if (current > Math.floor(max / 2)) return 'pp-3'
  return 'pp-0'
}
