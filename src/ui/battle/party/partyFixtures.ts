import type { BattleRequest, BattleView, MonView } from '../../../battle/protocol'
import { challengeFor } from '../../../core/challenge'
import { calcStats } from '../../../core/stats'
import { loadGameData } from '../../../data/gameData'

export const realData = loadGameData()
export const realChallenge = challengeFor({ trainerId: 'maximo', date: '2026-10-21' }, realData)
export const realTeam = realChallenge.playerTeam

const displayName = (speciesId: string): string => realData.dex.species[speciesId].name

/** Request del simulador para el equipo real del reto: el primero activo; `overrides` por posición. */
export function realRequest(overrides: Record<number, { condition?: string; active?: boolean }> = {}): BattleRequest {
  return {
    active: [{ moves: realTeam[0].moves.map((id) => ({ id, move: id })) }],
    side: {
      name: 'Jugador',
      id: 'p1',
      pokemon: realTeam.map((set, index) => ({
        ident: `p1: ${displayName(set.species)}`,
        details: `${displayName(set.species)}, L50${set.gender ? `, ${set.gender}` : ''}`,
        condition: overrides[index]?.condition ?? `${calcStats(realData.dex.species[set.species].baseStats, set.ivs, set.evs, set.nature, 50).hp}/${calcStats(realData.dex.species[set.species].baseStats, set.ivs, set.evs, set.nature, 50).hp}`,
        active: overrides[index]?.active ?? index === 0,
      })),
    },
  }
}

export function realView(ppUsed = 0): BattleView {
  const team: MonView[] = realTeam.map((set) => {
    const hp = calcStats(realData.dex.species[set.species].baseStats, set.ivs, set.evs, set.nature, 50).hp
    return {
      species: set.species,
      hpPercent: 100,
      status: null,
      fainted: false,
      hp,
      maxHp: hp,
      moves: set.moves.map((id) => {
        const base = Math.floor((realData.dex.moves[id].pp * 8) / 5)
        return { id, pp: Math.max(0, base - ppUsed), maxPp: base }
      }),
    }
  })
  return { turn: 1, weather: null, player: { remaining: 6, active: 0, team }, rival: { remaining: 6, active: 0, team: [] } }
}
