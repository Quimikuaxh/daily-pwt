import { isFaintedCondition } from '../condition'
import type { BattleRequest, Choice } from '../protocol'

/** IA trivial: primer movimiento utilizable, o primer Pokémon vivo en un cambio forzado. Sirve a los e2e y a los tests de motor. */
export function chooseTrivialAction(request: BattleRequest): Choice {
  if (request.forceSwitch) {
    const benchIndex = request.side.pokemon.findIndex((pokemon, index) => index > 0 && !isFaintedCondition(pokemon.condition))
    return { type: 'switch', slot: benchIndex + 1 }
  }

  const moves = request.active?.[0]?.moves ?? []
  const usableIndex = moves.findIndex((move) => !move.disabled && (move.pp === undefined || move.pp > 0))
  // Sin movimientos utilizables el simulador convierte el slot 1 en Forcejeo.
  return { type: 'move', slot: usableIndex < 0 ? 1 : usableIndex + 1 }
}
