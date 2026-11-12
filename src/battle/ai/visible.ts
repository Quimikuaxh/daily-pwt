import type { Battle, Pokemon } from '@pkmn/sim'
import { buildAiState, type AiMon, type AiState } from './state'

/**
 * Lo que el rival ha visto del jugador (Nuzlocke de Hoenn, Alto Mando y campeón; Jose, 12/11/2026: «solo lo que ha visto»). De cada
 * Pokémon del jugador sabe la especie solo si ha salido al campo; sus PS y cambios, como en su caja; sus movimientos, los que ha usado;
 * ni objeto ni habilidad (la de la especie, como cualquiera que conozca la Pokédex). Mientras no use ninguno, se supone un ataque básico
 * de cada uno de sus tipos (`BASIC_ATTACKS`), lo mínimo que se deduce de verlo. El nivel y las estadísticas salen de las reglas de la
 * campaña (20 IV, sin EV, naturaleza neutra), que son públicas.
 */

/** Un ataque de unos 60 de potencia de cada tipo en Esmeralda: lo que se supone que tiene un Pokémon del que aún no se ha visto nada. */
export const BASIC_ATTACKS: Readonly<Record<string, string>> = {
  Normal: 'headbutt', Fire: 'flamewheel', Water: 'bubblebeam', Electric: 'shockwave', Grass: 'magicalleaf', Ice: 'aurorabeam',
  Fighting: 'brickbreak', Poison: 'sludge', Ground: 'mudshot', Flying: 'wingattack', Psychic: 'psybeam', Bug: 'silverwind',
  Rock: 'ancientpower', Ghost: 'shadowpunch', Dragon: 'dragonbreath', Dark: 'bite', Steel: 'steelwing',
}

const seen = (pokemon: Pokemon) => pokemon.isActive || pokemon.previouslySwitchedIn > 0

function visibleMon(mon: AiMon, pokemon: Pokemon): AiMon {
  const used: string[] = pokemon.moveSlots.filter((slot) => slot.used).map((slot) => slot.id)
  const moves = used.length
    ? mon.moves.filter((move) => used.includes(move.id.replace(/^hiddenpower.+/, 'hiddenpower')))
    : pokemon.species.types.map((type) => ({ id: BASIC_ATTACKS[type], pp: 1, disabled: false })).filter((move) => move.id)
  return {
    ...mon,
    set: { ...mon.set, item: '', ability: pokemon.species.abilities[0] ? pokemon.species.abilities[0].toLowerCase().replace(/[^a-z0-9]/g, '') : mon.set.ability, moves: moves.map((move) => move.id) },
    moves,
  }
}

/** Estado de la IA con solo lo que el rival ha visto del jugador (su propio equipo lo conoce entero). */
export function buildVisibleAiState(battle: Battle): AiState {
  const full = buildAiState(battle)
  const foe = battle.sides[0].pokemon
  const pokemon = full.foe.pokemon.flatMap((mon, i) => (seen(foe[i]) ? [visibleMon(mon, foe[i])] : []))
  return { ...full, foe: { ...full.foe, pokemon } }
}
