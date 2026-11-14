import { describe, expect, it } from 'vitest'
import { Battle } from '@pkmn/sim'
import { createBattleEngine } from './engine'
import { computeDamage } from './damage'
import { buildAiState } from './ai/state'
import { mon } from '../test-utils/teams'
import { getDailyChallenge } from '../core/challenge'
import { HIDDEN_POWER_60_FROM } from '../core/launch'
import { loadGameData } from '../data/gameData'
import type { StatsTable } from '../core/types'
import { addDays } from '../test-utils/dates'

// UT-219 · Poder Oculto a potencia fija (Jose, 14/11/2026; DEC-100): desde `HIDDEN_POWER_60_FROM`, 60 en los dos bandos; antes, la de los IV.
const uniform = (iv: number): StatsTable => ({ hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv })
const user = (hiddenPowerPower?: number) =>
  mon('starmie', ['hiddenpower', 'hiddenpower', 'hiddenpower', 'hiddenpower'], { ability: 'naturalcure', ivs: uniform(20), ...(hiddenPowerPower ? { hiddenPowerPower } : {}) })
const foe = () => mon('snorlax', ['splash', 'splash', 'splash', 'splash'], { ability: 'thickfat', ivs: uniform(31) })

describe('Poder Oculto a potencia fija', () => {
  it('el reto lo marca en los sets con Poder Oculto desde HIDDEN_POWER_60_FROM, y solo en esos', () => {
    const data = loadGameData()
    const sets = (date: string) => { const c = getDailyChallenge(date, data); return [...c.playerTeam, ...c.rivalTeam] }
    let seen = 0
    for (let i = 0; i < 120; i += 1) {
      const date = addDays(HIDDEN_POWER_60_FROM, i)
      for (const set of sets(date)) {
        expect(set.hiddenPowerPower, `${date} ${set.species}`).toBe(set.moves.includes('hiddenpower') ? 60 : undefined)
        if (set.moves.includes('hiddenpower')) seen += 1
      }
    }
    expect(seen).toBeGreaterThan(0)
    for (let i = 1; i <= 30; i += 1) for (const set of sets(addDays(HIDDEN_POWER_60_FROM, -i))) expect(set.hiddenPowerPower).toBeUndefined()
  })

  it('el simulador pega con 60 (petición «Hidden Power Fighting 60») y sin ella con la de los IV (30)', () => {
    const request = (hiddenPowerPower?: number) => {
      const engine = createBattleEngine({ battleSeed: 'hp', player: [user(hiddenPowerPower)], playerLead: 0, rival: [user(hiddenPowerPower)], ai: 'trivial', maxTurns: 50 } as never)
      return engine.start().request?.active?.[0]?.moves[0]?.move
    }
    expect(request(60)).toBe('Hidden Power Fighting 60')
    expect(request()).toBe('Hidden Power Fighting 30')
  })

  it('el daño del simulador y el de la IA cuadran con 60', () => {
    const damageDealt = (hiddenPowerPower?: number) => {
      const engine = createBattleEngine({ battleSeed: 'hp', player: [user(hiddenPowerPower)], playerLead: 0, rival: [foe()], ai: 'trivial', maxTurns: 50 } as never)
      engine.start()
      const line = engine.choose({ type: 'move', slot: 1 }).lines.find((l) => /^\|-damage\|p2a: snorlax\|\d+\/100$/.test(l))
      return 100 - Number(/\|(\d+)\/100$/.exec(line ?? '')?.[1])
    }
    const fixed = damageDealt(60)
    const ivBased = damageDealt()
    expect(fixed).toBeGreaterThan(ivBased * 1.5)
    // La IA calcula con la potencia fija; sin ella, el calculador da 70 a la variante con tipo (comportamiento anterior, sin tocar).
    const calc60 = computeDamage({ set: user(60) }, { set: foe() }, 'hiddenpowerfighting')
    const calc70 = computeDamage({ set: user() }, { set: foe() }, 'hiddenpowerfighting')
    expect(calc60.max).toBeLessThan(calc70.max)
    expect(calc60.max).toBeGreaterThan(calc70.max * 0.8)
    const pct = (hp: number) => (hp / calc60.defenderMaxHp) * 100
    expect(fixed).toBeGreaterThanOrEqual(Math.floor(pct(calc60.min)))
    expect(fixed).toBeLessThanOrEqual(Math.ceil(pct(calc60.max)))
  })

  it('la IA ve la potencia fija en el estado (toBattleSet); sin ella, nada', () => {
    const aiSet = (hiddenPowerPower?: number) => {
      const battle = new Battle({ formatid: 'gen5customgame@@@!teampreview' as never, seed: [1, 2, 3, 4] as never })
      const toSim = (set: ReturnType<typeof user>) => ({ ...set, name: set.species, species: set.species, gender: '' }) as never
      battle.setPlayer('p1', { name: 'J', team: [toSim(foe())] })
      battle.setPlayer('p2', { name: 'R', team: [toSim(user(hiddenPowerPower))] })
      return buildAiState(battle).self.pokemon[0].set.hiddenPowerPower
    }
    expect(aiSet(60)).toBe(60)
    expect(aiSet()).toBeUndefined()
  })
})
