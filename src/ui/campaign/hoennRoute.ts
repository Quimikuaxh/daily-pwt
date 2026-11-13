/**
 * Ruta de la campaña de Hoenn (D7, maqueta Ruta aprobada el 11/11/2026): lugares del mapa de pared de Esmeralda con su casilla del cursor
 * (gRegionMapEntries + MAPCURSOR_MIN, en casillas de 8 px) y el rival de cada uno. La Liga se marca en Ciudad Colosalia con el campeón.
 */
import type { CampaignState } from '../../core/nuzlocke/campaign'

export type CampaignEncounter = { id: string; nameEs: string; kind: 'gym' | 'elite' | 'champion'; team: readonly { species: string; level: number }[] }

export type RoutePlace = { id: string; x: number; y: number; gym: number | null; rival: CampaignEncounter }

const PLACES: readonly { id: string; x: number; y: number }[] = [
  { id: 'petra', x: 1, y: 7 },
  { id: 'marcial', x: 3, y: 16 },
  { id: 'erico', x: 9, y: 8 },
  { id: 'candela', x: 6, y: 5 },
  { id: 'norman', x: 2, y: 11 },
  { id: 'alana', x: 13, y: 2 },
  { id: 'vito-y-leti', x: 25, y: 7 },
  { id: 'galano', x: 22, y: 9 },
  { id: 'plubio', x: 28, y: 10 },
]

/** Lugares de la ruta con su rival del catálogo; la Liga lleva al campeón. */
export function routePlaces(encounters: readonly CampaignEncounter[]): RoutePlace[] {
  return PLACES.map((place, i) => {
    const rival = encounters.find((encounter) => encounter.id === place.id)
    if (!rival) throw new Error(`Falta el rival ${place.id} en el catálogo de la campaña`)
    return { ...place, gym: rival.kind === 'gym' ? i + 1 : null, rival }
  })
}

/** Medallas: gimnasios superados (los ocho primeros encuentros son los gimnasios, en orden). */
export function badgeCount(state: Pick<CampaignState, 'encounterIndex' | 'phase'>, encounters: readonly CampaignEncounter[]): number {
  const gyms = encounters.filter((encounter) => encounter.kind === 'gym').length
  const beaten = state.encounterIndex + (state.phase === 'won' ? 1 : 0)
  return Math.min(gyms, beaten)
}

export type PlaceState = 'won' | 'next' | 'pending'

export const placeState = (place: RoutePlace, badges: number): PlaceState =>
  place.gym !== null && place.gym <= badges ? 'won' : (place.gym ?? 9) === badges + 1 ? 'next' : 'pending'

/** Villa Raíz (MAPSEC_LITTLEROOT_TOWN en (4,11) + MAPCURSOR_MIN): donde empieza la campaña. */
const LITTLEROOT = { x: 5, y: 13 } as const

/**
 * Dónde está el jugador en el mapa (el icono del protagonista del mapa de pared): la ciudad del último gimnasio ganado; antes del primero,
 * Villa Raíz.
 */
export const playerSpot = (places: readonly RoutePlace[], badges: number, leagueBeaten = 0): { x: number; y: number } => {
  // Ya dentro de la Liga (vencido el primero del Alto Mando), en Colosalia (Jose, 13/11/2026).
  if (leagueBeaten > 0) return places.find((place) => place.gym === null) ?? LITTLEROOT
  return badges === 0 ? LITTLEROOT : places.find((place) => place.gym === badges) ?? LITTLEROOT
}

/** Flechas de página de la ficha del Domo: la izquierda (x 2) y la derecha (x 230) que llevan a una página que existe. */
export function pageArrows(page: number, pages: number): { side: 'izda' | 'dcha'; target: number; x: number }[] {
  return ([['izda', -1, 2], ['dcha', 1, 230]] as const)
    .map(([side, step, x]) => ({ side, target: page + step, x }))
    .filter(({ target }) => target >= 0 && target < pages)
}

/** Página a la que lleva una flecha del teclado, o null si no hay. */
export function keyPage(key: string, page: number, pages: number): number | null {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  const target = page + (key === 'ArrowRight' ? 1 : -1)
  return target >= 0 && target < pages ? target : null
}
