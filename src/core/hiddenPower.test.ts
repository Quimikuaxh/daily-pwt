import { describe, expect, it } from 'vitest'
import { Battle } from '@pkmn/sim'
import { hiddenPower, resolveHiddenPowerId } from './hiddenPower'
import type { StatsTable } from './types'

const uniform = (iv: number): StatsTable => ({ hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv })

function simHiddenPower(ivs: StatsTable): { type: string; power: number } {
  const battle = new Battle({ formatid: 'gen5customgame@@@!teampreview' as never, seed: [1, 2, 3, 4] as never })
  battle.setPlayer('p1', { team: [{ species: 'Starmie', ability: 'Natural Cure', item: '', moves: ['hiddenpower'], level: 50, ivs, evs: {} } as never] })
  battle.setPlayer('p2', { team: [{ species: 'Snorlax', ability: 'Immunity', item: '', moves: ['splash'], level: 50 } as never] })
  const pokemon = battle.sides[0].pokemon[0]
  return { type: pokemon.hpType, power: pokemon.hpPower }
}

// UT-72 · Poder Oculto con su tipo y potencia reales (decisión de Jose, 22/10/2026).
describe('hiddenPower', () => {
  it('con los IV del jugador (iguales al rival): Lucha 30 (IV 20), Siniestro 30 (IV 25), Lucha 70 (IV 30)', () => {
    expect(hiddenPower(uniform(20))).toEqual({ type: 'Fighting', power: 30 })
    expect(hiddenPower(uniform(25))).toEqual({ type: 'Dark', power: 30 })
    expect(hiddenPower(uniform(30))).toEqual({ type: 'Fighting', power: 70 })
  })

  it('coincide con el simulador en IV variados', () => {
    const cases: StatsTable[] = [uniform(31), { hp: 31, atk: 30, def: 30, spa: 31, spd: 31, spe: 31 }, { hp: 31, atk: 31, def: 31, spa: 30, spd: 31, spe: 30 }, { hp: 3, atk: 14, def: 27, spa: 8, spd: 19, spe: 0 }]
    for (const ivs of cases) expect(hiddenPower(ivs), JSON.stringify(ivs)).toEqual(simHiddenPower(ivs))
  })

  it('resolveHiddenPowerId solo cambia Poder Oculto', () => {
    expect(resolveHiddenPowerId('hiddenpower', uniform(25))).toBe('hiddenpowerdark')
    expect(resolveHiddenPowerId('surf', uniform(25))).toBe('surf')
    expect(resolveHiddenPowerId('hiddenpower', undefined)).toBe('hiddenpower')
  })
})
