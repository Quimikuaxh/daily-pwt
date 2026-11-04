import { describe, expect, it } from 'vitest'
import { getDailyChallenge } from './challenge'
import { LAUNCH_DATE, NO_SYNERGY_TAG, POOL_RULES_FROM } from './launch'
import { loadGameData } from '../data/gameData'
import { addDays } from '../test-utils/dates'
import type { ResolvedSet } from './types'

// UT-146 · Desde POOL_RULES_FROM el jugador no recibe sets del PWT sin sinergia (Jose, 04/11/2026; DEC-79).
const data = loadGameData()
const key = (set: { species: string; item: string | null; moves: readonly string[] }) => JSON.stringify([set.species, set.item, [...set.moves].sort()])
const excluded = new Set(data.playerSets.filter((set) => set.tags?.includes(NO_SYNERGY_TAG)).map(key))
const usesExcluded = (team: ResolvedSet[]) => team.some((member) => excluded.has(key(member)))

describe('pool del jugador desde POOL_RULES_FROM (UT-146)', () => {
  it('hay sets marcados y antes de la fecha algún reto los usaba (los ya publicados no cambian)', () => {
    expect(excluded.size).toBeGreaterThan(0)
    const days = Array.from({ length: 40 }, (_, index) => addDays(LAUNCH_DATE, index)).filter((date) => date < POOL_RULES_FROM)
    expect(days.some((date) => usesExcluded(getDailyChallenge(date, data).playerTeam))).toBe(true)
  })

  it('desde la fecha, ningún equipo del jugador lleva uno de esos sets', () => {
    for (let offset = 0; offset < 120; offset++) {
      const date = addDays(POOL_RULES_FROM, offset)
      expect(usesExcluded(getDailyChallenge(date, data).playerTeam), date).toBe(false)
    }
  })
})
