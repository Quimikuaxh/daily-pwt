import { mkResolved } from './fixtures'
import type { ResolvedSet } from './types'

/** Equipos de escenario para los tests de motor. El rival 'trivial' usa SIEMPRE su primer movimiento habilitado. */
export const HARMLESS: [string, string, string, string] = ['splash', 'tackle', 'recover', 'protect']

export const filler = (species: string, over: Partial<ResolvedSet> = {}): ResolvedSet =>
  mkResolved(species, '', 'pressure', HARMLESS, over)

/** Equipo de 6 especies distintas e inocuas (la primera es el inicial). */
export const harmlessTeam = (lead?: ResolvedSet): ResolvedSet[] => [
  lead ?? filler('shuckle'),
  filler('blissey'), filler('snorlax'), filler('wobbuffet'), filler('chansey'), filler('slowbro'),
]

/** Equipo con `lead` y relleno inocuo detrás. */
export const withLead = (lead: ResolvedSet, ...rest: ResolvedSet[]): ResolvedSet[] => {
  const base = harmlessTeam()
  return [lead, ...rest, ...base.slice(1 + rest.length)].slice(0, 6)
}

export const mon = (species: string, moves: [string, string, string, string], over: Partial<ResolvedSet> & { item?: string; ability?: string } = {}): ResolvedSet =>
  mkResolved(species, over.item ?? '', over.ability ?? 'pressure', moves, over)

/** Equipos de jugador y rival para combates largos (todos con ataques reales). */
export const attackers = (): ResolvedSet[] => [
  mon('garchomp', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { item: 'lifeorb', ability: 'roughskin' }),
  mon('starmie', ['surf', 'icebeam', 'thunderbolt', 'recover'], { item: 'leftovers', ability: 'naturalcure' }),
  mon('tyranitar', ['crunch', 'stoneedge', 'earthquake', 'pursuit'], { item: 'leftovers', ability: 'sandstream' }),
  mon('heatran', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock'], { item: 'leftovers', ability: 'flashfire' }),
  mon('milotic', ['surf', 'icebeam', 'recover', 'toxic'], { item: 'leftovers', ability: 'marvelscale' }),
  mon('scizor', ['bulletpunch', 'uturn', 'superpower', 'roost'], { item: 'leftovers', ability: 'technician' }),
]
