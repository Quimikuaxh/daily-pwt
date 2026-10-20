import { Generations, Pokemon, Move, Field, calculate } from '@smogon/calc'
import { gen5 } from './dex'
import type { ResolvedSet } from './types'

/** Oráculo de daño para los tests de IA: @smogon/calc Gen 5, siempre Generations.get(5). */
const G = Generations.get(5)
const nameOf = (kind: 'species' | 'moves' | 'items' | 'abilities', id: string): string => (gen5 as any)[kind].get(id)?.name ?? id

export type Boosts = Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>

export function calcMon(set: ResolvedSet, opts: { hp?: number; boosts?: Boosts; status?: string } = {}) {
  return new Pokemon(G, nameOf('species', set.species), {
    level: 50,
    item: set.item ? nameOf('items', set.item) : undefined,
    ability: set.ability ? nameOf('abilities', set.ability) : undefined,
    nature: set.nature,
    ivs: set.ivs,
    evs: set.evs,
    boosts: opts.boosts,
    curHP: opts.hp,
    status: opts.status as any,
  })
}

export const maxHpOf = (set: ResolvedSet): number => calcMon(set).maxHP()

/** Rango [mín, máx] de daño sin crítico de `moveId` de `att` a `def`. */
export function damageRange(
  att: ResolvedSet, def: ResolvedSet, moveId: string,
  opts: { weather?: string | null; attBoosts?: Boosts; defBoosts?: Boosts } = {},
): [number, number] {
  const weather = ({ raindance: 'Rain', sunnyday: 'Sun', sandstorm: 'Sand', hail: 'Hail' } as Record<string, string>)[opts.weather ?? ''] 
  const r = calculate(
    G,
    calcMon(att, { boosts: opts.attBoosts }),
    calcMon(def, { boosts: opts.defBoosts }),
    new Move(G, nameOf('moves', moveId)),
    new Field({ weather: weather as any }),
  )
  const range = r.range()
  return [range[0], range[1]]
}

/** Daño esperado (media del rango × precisión) del movimiento; sirve de oráculo para la regla 2. */
export function expectedDamage(att: ResolvedSet, def: ResolvedSet, moveId: string, weather: string | null = null): number {
  const [lo, hi] = damageRange(att, def, moveId, { weather })
  const acc = gen5.moves.get(moveId)!.accuracy
  return ((lo + hi) / 2) * (acc === true ? 1 : acc / 100)
}
