/**
 * Modelo de la pantalla Equipo y PC de la campaña (D7, maqueta aprobada el 11/11/2026): el equipo de seis huecos (los que pasan del
 * límite del rival quedan sin plaza), la CAJA 1 con los reclutados vivos que no van y BAJAS con los debilitados, que no se mueven.
 * Mover o intercambiar es puro: la pantalla solo pinta y traduce gestos (arrastrar, tocar origen y destino, teclado) a `moveMon`.
 */
import type { CampaignState } from '../../core/nuzlocke/campaign'
import type { GameData } from '../../core/types'

export const PARTY_SIZE = 6
export const BOX_SIZE = 30

export type TeamMon = { id: string; species: string; name: string; level: number; hp: number; item: string | null }
export type Place = { area: 'party'; i: number } | { area: 'box'; box: number; i: number }
export type TeamLayout = {
  party: readonly (string | null)[]
  boxes: readonly { ko: boolean; mons: readonly (string | null)[] }[]
}
/** Motivo por el que no se puede mover (claves de esCampaign.team.notes). */
export type MoveNote = 'fainted' | 'empty' | 'limit' | 'lastOne'

const fill = <T,>(items: readonly T[], size: number): (T | null)[] => [...items, ...Array(Math.max(0, size - items.length)).fill(null)]

/** PS al nivel con IV 20 (o los de Poder Oculto si los tiene), sin EV y naturaleza neutra; Shedinja, siempre 1. */
export function teamMonOf(member: CampaignState['members'][number], data: GameData): TeamMon {
  const base = data.dex.species[member.species]?.baseStats.hp ?? 0
  const iv = member.hiddenPowerIvs?.hp ?? 20
  const hp = member.species === 'shedinja' ? 1 : Math.floor(((2 * base + iv) * member.level) / 100) + member.level + 10
  return {
    id: member.id, species: member.species, level: member.level, hp, item: member.item ?? null,
    name: (data.names.species[member.species] ?? member.species).toUpperCase(),
  }
}

/**
 * Colocación inicial: los vivos en el orden de la alineación anterior (`preferred`) y después en el de reclutamiento, hasta el límite;
 * el resto, a la CAJA 1; los debilitados, a BAJAS.
 */
export function initialLayout(state: CampaignState, limit: number, preferred: readonly string[] = []): TeamLayout {
  const alive = state.members.filter((member) => !member.fainted).map((member) => member.id)
  const ordered = [...preferred.filter((id) => alive.includes(id)), ...alive.filter((id) => !preferred.includes(id))]
  return {
    party: fill(ordered.slice(0, limit), PARTY_SIZE),
    boxes: [
      { ko: false, mons: fill(ordered.slice(limit), BOX_SIZE) },
      { ko: true, mons: fill(state.members.filter((member) => member.fainted).map((member) => member.id), BOX_SIZE) },
    ],
  }
}

export const monAt = (layout: TeamLayout, place: Place): string | null =>
  place.area === 'party' ? layout.party[place.i] ?? null : layout.boxes[place.box]?.mons[place.i] ?? null

export const samePlace = (a: Place | null, b: Place | null): boolean =>
  !!a && !!b && a.area === b.area && a.i === b.i && (a.area === 'party' || (b.area === 'box' && a.box === b.box))

export const partyCount = (layout: TeamLayout): number => layout.party.filter(Boolean).length
export const lineup = (layout: TeamLayout): string[] => layout.party.filter((id): id is string => !!id)

/** Mueve (o intercambia si el destino está ocupado) y compacta el equipo hacia arriba. Devuelve el motivo si no se puede. */
export function moveMon(layout: TeamLayout, from: Place, to: Place, limit: number): { layout: TeamLayout; note: MoveNote | null } {
  const blocked = (place: Place) => place.area === 'box' && layout.boxes[place.box]?.ko
  if (blocked(from) || blocked(to)) return { layout, note: 'fainted' }
  const moving = monAt(layout, from)
  if (!moving) return { layout, note: 'empty' }
  if (samePlace(from, to)) return { layout, note: null }
  if (to.area === 'party' && to.i >= limit) return { layout, note: 'limit' }
  const target = monAt(layout, to)
  if (from.area === 'party' && to.area === 'box' && !target && partyCount(layout) === 1) return { layout, note: 'lastOne' }

  const party = [...layout.party]
  const boxes = layout.boxes.map((box) => ({ ...box, mons: [...box.mons] }))
  const put = (place: Place, value: string | null) => {
    if (place.area === 'party') party[place.i] = value
    else boxes[place.box].mons[place.i] = value
  }
  put(to, moving)
  put(from, target)
  const compact = fill(party.filter((id): id is string => !!id), PARTY_SIZE)
  return { layout: { party: compact, boxes }, note: null }
}

/** Colocación de Equipo y PC guardada en la pantalla, si sigue valiendo: los mismos miembros y no más en el equipo que el límite. */
export function fittingLayout(layout: TeamLayout | null, state: CampaignState, limit: number): TeamLayout | null {
  if (!layout) return null
  const placed = [...layout.party, ...layout.boxes.flatMap((box) => box.mons)].filter((id): id is string => id !== null)
  const members = state.members.map((member) => member.id)
  const party = layout.party.filter((id) => id !== null)
  const fainted = new Set(state.members.filter((member) => member.fainted).map((member) => member.id))
  const same = placed.length === members.length && members.every((id) => placed.includes(id))
  return same && party.length <= limit && party.every((id) => !fainted.has(id)) ? layout : null
}

