import { describe, expect, it } from 'vitest'
import { loadGameData } from '../data/gameData'
import { dateForTrainer } from '../test-utils/ui'
import { calcStats } from './stats'
import { getDailyChallenge } from './challenge'

// RF-16: el jugador lleva los mismos IV que el rival del día (20 líderes, 25 campeones, 30 Rojo), EV 0 y naturaleza Seria.
const data = loadGameData()

describe('IV del jugador = IV del rival del día', () => {
  for (const [label, trainerId, iv] of [['líder', 'brock', 20], ['campeón', 'plubio', 25], ['Rojo', 'rojo', 30]] as const) {
    it(`contra ${label} (${trainerId}): IV ${iv}, EV 0, naturaleza Seria y estadísticas calculadas con ellos`, () => {
      const challenge = getDailyChallenge(dateForTrainer(trainerId, data), data)
      expect(challenge.trainer.id).toBe(trainerId)
      expect(challenge.rivalTeam.every((set) => Object.values(set.ivs).every((value) => value === iv))).toBe(true)
      for (const set of challenge.playerTeam) {
        expect(Object.values(set.ivs).every((value) => value === iv), set.species).toBe(true)
        expect(Object.values(set.evs).every((value) => value === 0)).toBe(true)
        expect(set.nature).toBe('Serious')
        const base = data.dex.species[set.species].baseStats
        const expected = calcStats(base, set.ivs, set.evs, set.nature, 50)
        const withIv31 = calcStats(base, { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, set.evs, set.nature, 50)
        const total = (stats: typeof expected) => stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe
        if (iv < 30) expect(total(expected)).toBeLessThan(total(withIv31))
        else expect(total(expected)).toBeLessThanOrEqual(total(withIv31))
      }
    })
  }

  it('el reto sigue siendo puro: mismas entradas, mismos IV', () => {
    const date = dateForTrainer('rojo', data)
    expect(getDailyChallenge(date, data).playerTeam.map((set) => set.ivs)).toEqual(getDailyChallenge(date, data).playerTeam.map((set) => set.ivs))
  })
})
