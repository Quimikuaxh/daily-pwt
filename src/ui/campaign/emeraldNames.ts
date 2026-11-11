/**
 * Nombres de la campaña como en la edición española de Esmeralda: movimientos de la época (emerald-move-names-es.json, p. ej. LÁTIGO y
 * no Agitacola) y Pokémon en mayúsculas. Los mensajes del combate salen del traductor del diario con estos nombres.
 */
import type { NamesEs } from '../../core/types'
import eraMoves from '../../../data/nuzlocke/emerald-move-names-es.json'

const moves = eraMoves.moves as Record<string, string>

/** Nombre del movimiento en Esmeralda; si no es de la campaña, el actual en mayúsculas. */
export const emeraldMoveName = (id: string, names: NamesEs): string => moves[id] ?? (names.moves[id] ?? id).toUpperCase()

/** Nombres para el traductor de mensajes del combate de campaña: movimientos de la época y Pokémon en mayúsculas. */
export function emeraldBattleNames(names: NamesEs): NamesEs {
  return {
    ...names,
    moves: { ...names.moves, ...moves },
    species: Object.fromEntries(Object.entries(names.species).map(([id, name]) => [id, name.toUpperCase()])),
  }
}
