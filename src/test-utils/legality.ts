import { gen5, toId } from './dex'
import { isForbidden } from './rules'
import type { PokemonSet } from './types'

/**
 * Validador de legalidad Gen 5 usado por los tests de datos (UT-28), basado en @pkmn/data Gen 5:
 * especie, objeto, habilidad (de la especie), movimientos existentes y aprendibles, y nada prohibido en el PWT.
 * Devuelve la lista de problemas (vacía = legal).
 */
export async function gen5Problems(set: PokemonSet, bannedMoveIds: string[] = []): Promise<string[]> {
  const out: string[] = []
  const sp = gen5.species.get(set.species)
  if (!sp) return [`especie no existe en Gen 5: ${set.species}`]
  if (isForbidden(sp.id)) out.push(`prohibido en el PWT: ${sp.id}`)
  if (!gen5.items.get(set.item)) out.push(`objeto no existe en Gen 5: ${set.item}`)
  const abilityIds = Object.values(sp.abilities).map((a) => toId(a as string))
  for (const a of set.abilities) if (!abilityIds.includes(a)) out.push(`habilidad ${a} no es de ${sp.id}`)
  for (const m of set.moves) {
    if (!gen5.moves.get(m)) { out.push(`movimiento no existe en Gen 5: ${m}`); continue }
    if (bannedMoveIds.includes(m)) out.push(`movimiento prohibido: ${m}`)
    const id = m.startsWith('hiddenpower') ? 'hiddenpower' : m
    if (!(await gen5.learnsets.canLearn(sp.id, id as any))) out.push(`${sp.id} no aprende ${m} en Gen 5`)
  }
  return out
}
