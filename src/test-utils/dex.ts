import { Dex } from '@pkmn/dex'
import { Generations } from '@pkmn/data'
import type { DexData, NamesEs, StatsTable } from './types'

export const gen5 = new Generations(Dex).get(5)
export const GEN5_TYPES = [...gen5.types].map((t) => t.name)

export const toId = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
export const statsOf = (v: number): StatsTable => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })
export { STAT_KEYS }

/** DexData mínimo construido desde @pkmn/data Gen 5 para las especies y movimientos dados. */
export function makeDex(speciesIds: string[], moveIds: string[]): DexData {
  const species: DexData['species'] = {}
  for (const id of new Set(speciesIds)) {
    const s = gen5.species.get(id)
    if (!s) throw new Error(`fixture: especie desconocida ${id}`)
    species[s.id] = {
      id: s.id,
      name: s.name,
      types: [...s.types],
      baseStats: { ...s.baseStats } as StatsTable,
      abilities: Object.values(s.abilities),
      nfe: !!s.nfe,
      spriteId: s.id,
    }
  }
  const moves: DexData['moves'] = {}
  for (const id of new Set(moveIds)) {
    const m = gen5.moves.get(id)
    if (!m) throw new Error(`fixture: movimiento desconocido ${id}`)
    // Igual que scripts/build-dex.mjs: los 16 Hidden Power comparten id en @pkmn y el dex de producción los separa por nombre.
    const key = toId(m.name)
    moves[key] = {
      id: key,
      name: m.name,
      type: m.type,
      category: m.category,
      basePower: m.basePower,
      accuracy: m.accuracy,
      pp: m.pp,
    }
  }
  const typeChart: DexData['typeChart'] = {}
  for (const atk of GEN5_TYPES) {
    typeChart[atk] = {}
    for (const def of GEN5_TYPES) typeChart[atk][def] = (gen5.types.get(atk) as any).effectiveness[def]
  }
  return { species, moves, typeChart }
}

const ES: Record<string, string> = {
  onix: 'Onix', golem: 'Golem', kabutops: 'Kabutops', omastar: 'Omastar', aerodactyl: 'Aerodactyl',
  relicanth: 'Relicanth', tyranitar: 'Tyranitar', rhyperior: 'Rhyperior', starmie: 'Starmie',
  gyarados: 'Gyarados', lapras: 'Lapras', garchomp: 'Garchomp', earthquake: 'Terremoto',
  surf: 'Surf', thunderbolt: 'Rayo', shadowball: 'Bola Sombra', stealthrock: 'Trampa Rocas',
  swordsdance: 'Danza Espada', tackle: 'Placaje', splash: 'Salpicadura', struggle: 'Forcejeo',
  flamethrower: 'Lanzallamas', icebeam: 'Rayo Hielo', leftovers: 'Restos', lifeorb: 'Vidasfera',
  choicescarf: 'Pañuelo Elección', sitrusberry: 'Baya Zidra', rockslide: 'Avalancha',
}
const cap = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

/** Nombres "en español" sintéticos: el diccionario ES si existe; si no, el id capitalizado. */
export function makeNames(ids: { species?: string[]; moves?: string[]; abilities?: string[]; items?: string[] }): NamesEs {
  const fill = (list: string[] = []) => Object.fromEntries(list.map((id) => [id, ES[id] ?? cap(id)]))
  return {
    species: fill(ids.species),
    moves: fill(ids.moves),
    abilities: fill(ids.abilities),
    items: fill(ids.items),
    types: Object.fromEntries(GEN5_TYPES.map((t) => [t, t])),
  }
}
