/**
 * Nombres de la campaña como en la edición española de Esmeralda: movimientos, habilidades y objetos de la época
 * (data/nuzlocke/emerald-*-names-es.json; p. ej. LÁTIGO y no Agitacola, RASTRO y no Calco) y Pokémon en mayúsculas. Los mensajes del
 * combate salen del traductor del diario con estos nombres.
 */
import type { NamesEs } from '../../core/types'
import eraMoves from '../../../data/nuzlocke/emerald-move-names-es.json'
import eraAbilities from '../../../data/nuzlocke/emerald-ability-names-es.json'
import eraItems from '../../../data/nuzlocke/emerald-item-names-es.json'

const moves = eraMoves.moves as Record<string, string>
const abilities = eraAbilities.abilities as Record<string, string>
const items = eraItems.items as Record<string, string>

/** Nombre del movimiento en Esmeralda; si no es de la campaña, el actual en mayúsculas. */
export const emeraldMoveName = (id: string, names: NamesEs): string => moves[id] ?? (names.moves[id] ?? id).toUpperCase()

/** Nombre de la habilidad en Esmeralda (las 76 de Gen 3); si no es de Gen 3, el actual en mayúsculas. */
export const emeraldAbilityName = (id: string, names: NamesEs): string => abilities[id] ?? (names.abilities[id] ?? id).toUpperCase()

/** Nombres para el traductor de mensajes del combate de campaña: movimientos, habilidades y objetos de la época y Pokémon en mayúsculas. */
export function emeraldBattleNames(names: NamesEs): NamesEs {
  return {
    ...names,
    moves: { ...names.moves, ...moves },
    abilities: { ...names.abilities, ...abilities },
    items: { ...names.items, ...items },
    species: Object.fromEntries(Object.entries(names.species).map(([id, name]) => [id, name.toUpperCase()])),
  }
}
