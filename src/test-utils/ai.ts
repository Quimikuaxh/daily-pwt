import { maxHpOf } from './calc'
import { gen5, toId } from './dex'
import { mkResolved } from './fixtures'
import type { ResolvedSet } from './types'

/**
 * Fixtures de AiState (DEC-12). Contrato asumido (TODO-CONTRATO, src/battle/ai/state.ts):
 *   AiMon  = { set: ResolvedSet; hp; maxHp; status: string|null; boosts: {atk,def,spa,spd,spe,accuracy,evasion?}; fainted: boolean;
 *              moves: { id: string; pp: number; disabled: boolean }[] }
 *   AiState = { turn: number; weather: string|null;
 *               self: { pokemon: AiMon[]; trapped: boolean; mustSwitch: boolean };   // pokemon[0] = activo; orden = request.side.pokemon
 *               foe:  { pokemon: AiMon[] } }                                         // pokemon[0] = activo del jugador
 *   Choice = { type: 'move' | 'switch'; slot: number }   // slot 1-based: movimiento del activo o posición en self.pokemon
 */
export type AiMon = {
  set: ResolvedSet
  hp: number
  maxHp: number
  status: string | null
  boosts: Record<string, number>
  fainted: boolean
  moves: { id: string; pp: number; disabled: boolean }[]
}
export type AiState = {
  turn: number
  weather: string | null
  self: { pokemon: AiMon[]; trapped: boolean; mustSwitch: boolean }
  foe: { pokemon: AiMon[] }
}
export type Choice = { type: 'move' | 'switch'; slot: number }

export function mkMon(set: ResolvedSet, over: Partial<AiMon> & { hpFraction?: number } = {}): AiMon {
  const maxHp = maxHpOf(set)
  const { hpFraction, ...rest } = over
  const hp = rest.hp ?? Math.max(1, Math.round(maxHp * (hpFraction ?? 1)))
  return {
    set,
    hp,
    maxHp,
    status: null,
    boosts: {},
    fainted: hp <= 0,
    moves: set.moves.map((id) => ({ id, pp: gen5.moves.get(id)?.pp ?? 16, disabled: false })),
    ...rest,
  }
}

export function mkState(self: AiMon[], foe: AiMon[], over: Partial<Omit<AiState, 'self' | 'foe'>> & { trapped?: boolean; mustSwitch?: boolean } = {}): AiState {
  const { trapped = false, mustSwitch = false, ...rest } = over
  return { turn: 1, weather: null, self: { pokemon: self, trapped, mustSwitch }, foe: { pokemon: foe }, ...rest }
}

/** Atajo: Pokémon con IVs 20 (rival), nature neutra. */
export const rs = (species: string, item: string, ability: string, moves: [string, string, string, string]): ResolvedSet =>
  mkResolved(species, item, toId(ability), moves, { ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 } })

/** Slot (1-based) del movimiento `id` en el activo propio. */
export const slotOf = (state: AiState, id: string): number => state.self.pokemon[0].moves.findIndex((m) => m.id === id) + 1
