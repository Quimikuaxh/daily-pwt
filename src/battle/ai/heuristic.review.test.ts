import { describe, it, expect } from 'vitest'
import { chooseRivalAction, aiSeed } from './heuristic'
import { Prng } from '../../core/prng'
import { mkMon, mkState, rs, slotOf } from '../../test-utils/ai'

// Revisión de código, ciclo 1: refinamientos de la regla 1 (KO garantizado) y de las inmunidades de estado.
const choose = (state: any, seed = 'review') => chooseRivalAction(state, new Prng(aiSeed(seed)))
const skarmoryWith = (ability: string, item = 'leftovers') => rs('skarmory', item, ability, ['roost', 'spikes', 'bravebird', 'whirlwind'])

describe('regla 1: movimientos poco fiables', () => {
  const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['suckerpunch', 'stoneedge', 'swordsdance', 'rockslide'])
  const heatran = rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock'])

  it('Sorpresa (puede fallar) no cuenta como KO garantizado aunque sea el más preciso', () => {
    const state = mkState([mkMon(garchomp)], [mkMon(heatran, { hp: 1 })])
    expect(choose(state).slot).not.toBe(slotOf(state, 'suckerpunch'))
  })

  it('con otro KO fiable elige ese (Avalancha 90 % sobre Roca Afilada 80 %)', () => {
    const state = mkState([mkMon(garchomp)], [mkMon(heatran, { hp: 1 })])
    expect(choose(state).slot).toBe(slotOf(state, 'rockslide'))
  })
})

describe('regla 1: Robustez y Banda Focus a PS completos', () => {
  const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['stoneedge', 'earthquake', 'swordsdance', 'rockslide'])
  const fullHp = (set: ReturnType<typeof skarmoryWith>) => mkMon(set, { hp: 5, maxHp: 5 })

  it('precondición: sin Robustez, Avalancha (90 %) es el KO más preciso', () => {
    const state = mkState([mkMon(garchomp)], [fullHp(skarmoryWith('keeneye'))])
    expect(choose(state).slot).toBe(slotOf(state, 'rockslide'))
  })

  it('con Robustez a PS completos no hay KO garantizado: decide el mayor daño esperado (Roca Afilada)', () => {
    const state = mkState([mkMon(garchomp)], [fullHp(skarmoryWith('sturdy'))])
    expect(choose(state).slot).toBe(slotOf(state, 'stoneedge'))
  })

  it('con Banda Focus a PS completos tampoco', () => {
    const state = mkState([mkMon(garchomp)], [fullHp(skarmoryWith('keeneye', 'focussash'))])
    expect(choose(state).slot).toBe(slotOf(state, 'stoneedge'))
  })

  it('con Robustez pero sin PS completos el KO sigue valiendo', () => {
    const state = mkState([mkMon(garchomp)], [mkMon(skarmoryWith('sturdy'), { hp: 1 })])
    expect(choose(state).slot).toBe(slotOf(state, 'rockslide'))
  })
})

describe('regla 3: Absorbe Fuego frente a Fuego Fatuo', () => {
  // Rival que solo tiene un ataque flojo: con el objetivo sano lanza el estado. Snorlax con Absorbe Fuego (ficticio) aísla la habilidad del tipo.
  const rival = rs('chansey', 'leftovers', 'naturalcure', ['willowisp', 'softboiled', 'recover', 'protect'])
  const against = (ability: string) => mkState([mkMon(rival)], [mkMon(rs('snorlax', 'leftovers', ability, ['rest', 'curse', 'yawn', 'sleeptalk']))])

  it('precondición: contra un objetivo sin la habilidad se usa Fuego Fatuo', () => {
    const state = against('immunity')
    expect(choose(state).slot).toBe(slotOf(state, 'willowisp'))
  })

  it('no lanza Fuego Fatuo a un Pokémon con Absorbe Fuego', () => {
    const state = against('flashfire')
    expect(choose(state).slot).not.toBe(slotOf(state, 'willowisp'))
  })
})
