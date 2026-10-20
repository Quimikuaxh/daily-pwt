import { describe, it, expect } from 'vitest'
import { Dex } from '@pkmn/dex'
import { Generations } from '@pkmn/data'
import { Battle } from '@pkmn/sim'
import { calcStats } from './stats'

// UT-06 · RF-16/35. calcStats(base, ivs, evs, nature, level) -> StatsTable.
const gen5 = new Generations(Dex).get(5)
const KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
const all = (v: number) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })

function reference(species: string, ivs: any, evs: any, nature: string) {
  const sp = gen5.species.get(species)!
  const nat = gen5.natures.get(nature)
  return Object.fromEntries(
    KEYS.map((k) => [k, gen5.stats.calc(k, sp.baseStats[k], ivs[k], evs[k], 50, k === 'hp' ? undefined : nat)]),
  )
}

describe('calcStats', () => {
  it.each([
    ['garchomp', 'Serious', all(31), all(0)],
    ['garchomp', 'Adamant', all(31), all(0)],
    ['starmie', 'Timid', all(20), all(0)],
    ['onix', 'Serious', all(25), all(0)],
    ['snorlax', 'Careful', all(30), all(0)],
    ['blissey', 'Bold', all(31), { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 }],
  ])('coincide con @pkmn/data Gen 5 para %s (%s)', (species, nature, ivs, evs) => {
    const base = gen5.species.get(species)!.baseStats
    expect(calcStats(base as any, ivs, evs, nature, 50)).toEqual(reference(species, ivs, evs, nature))
  })

  it('Shedinja tiene siempre 1 PS', () => {
    const base = gen5.species.get('shedinja')!.baseStats
    expect(calcStats(base as any, all(31), all(252), 'Serious', 50).hp).toBe(1)
  })

  it('la naturaleza neutra no altera ningún stat respecto a Hardy', () => {
    const base = gen5.species.get('garchomp')!.baseStats as any
    expect(calcStats(base, all(31), all(0), 'Serious', 50)).toEqual(calcStats(base, all(31), all(0), 'Hardy', 50))
  })

  it('una naturaleza beneficiosa sube un stat y baja otro', () => {
    const base = gen5.species.get('garchomp')!.baseStats as any
    const neutral = calcStats(base, all(31), all(0), 'Serious', 50)
    const adamant = calcStats(base, all(31), all(0), 'Adamant', 50)
    expect([adamant.atk > neutral.atk, adamant.spa < neutral.spa]).toEqual([true, true])
  })

  it('el nivel 50 con IV 31 y EV 0 da el valor esperado de Garchomp (PS 183)', () => {
    const base = gen5.species.get('garchomp')!.baseStats as any
    expect(calcStats(base, all(31), all(0), 'Serious', 50).hp).toBe(183)
  })

  it('con EV 252 el stat sube respecto a EV 0', () => {
    const base = gen5.species.get('garchomp')!.baseStats as any
    const lo = calcStats(base, all(31), all(0), 'Serious', 50)
    const hi = calcStats(base, all(31), all(252), 'Serious', 50)
    expect(hi.atk).toBeGreaterThan(lo.atk)
  })

  it('con IV 0 el stat baja respecto a IV 31', () => {
    const base = gen5.species.get('garchomp')!.baseStats as any
    expect(calcStats(base, all(0), all(0), 'Serious', 50).spe).toBeLessThan(calcStats(base, all(31), all(0), 'Serious', 50).spe)
  })

  it('coincide con los stats que calcula el simulador', () => {
    const ivs = all(20)
    const evs = all(0)
    const battle = new Battle({ formatid: 'gen5customgame@@@!teampreview' as any, seed: '1,2,3,4' })
    battle.setPlayer('p1', { name: 'A', team: `Garchomp||leftovers|roughskin|earthquake|Adamant|0,0,0,0,0,0||20,20,20,20,20,20||50|` })
    battle.setPlayer('p2', { name: 'B', team: `Starmie||leftovers|naturalcure|surf|Timid|0,0,0,0,0,0||20,20,20,20,20,20||50|` })
    const simStats = battle.sides[0].pokemon[0].storedStats
    const mine = calcStats(gen5.species.get('garchomp')!.baseStats as any, ivs, evs, 'Adamant', 50)
    expect({ atk: simStats.atk, def: simStats.def, spa: simStats.spa, spd: simStats.spd, spe: simStats.spe, hp: battle.sides[0].pokemon[0].maxhp })
      .toEqual({ atk: mine.atk, def: mine.def, spa: mine.spa, spd: mine.spd, spe: mine.spe, hp: mine.hp })
  })
})
