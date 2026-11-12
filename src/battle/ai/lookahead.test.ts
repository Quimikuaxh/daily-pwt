import { describe, expect, it } from 'vitest'
import { Prng } from '../../core/prng'
import { aiSeed, chooseRivalAction } from './heuristic'
import { chooseLookaheadAction } from './lookahead'
import { buildVisibleAiState, BASIC_ATTACKS } from './visible'
import { mkMon, mkState, rs, slotOf } from '../../test-utils/ai'
import { newBattle } from '../../test-utils/sim'
import { mkResolved } from '../../test-utils/fixtures'

// UT-195 · IA del Alto Mando y del campeón de la Nuzlocke (Jose, 12/11/2026): mira un turno por delante (opción 2) con solo lo que ha
// visto del jugador. La heurística del diario no cambia (sus tests siguen igual).
const SEEDS = Array.from({ length: 12 }, (_, i) => `semilla-${i}`)
const choose = (state: unknown, seed: string) => chooseLookaheadAction(state as never, new Prng(aiSeed(seed)))

describe('mirar un turno por delante', () => {
  it('con dos golpes que debilitan, usa el de prioridad si el jugador es más rápido y le debilitaría antes', () => {
    const dragonite = rs('dragonite', 'leftovers', 'innerfocus', ['outrage', 'extremespeed', 'roost', 'dragondance'])
    const garchomp = rs('garchomp', 'leftovers', 'roughskin', ['outrage', 'earthquake', 'swordsdance', 'stoneedge'])
    const state = mkState([mkMon(dragonite, { hp: 20 })], [mkMon(garchomp, { hp: 5 })])
    expect(SEEDS.map((seed) => choose(state, seed))).toEqual(SEEDS.map(() => ({ type: 'move', slot: slotOf(state, 'extremespeed') })))
    // La heurística, sin mirar quién va antes, a veces elige Enfado.
    expect(SEEDS.some((seed) => chooseRivalAction(state as never, new Prng(aiSeed(seed))).slot === slotOf(state, 'outrage'))).toBe(true)
  })

  it('cambia a quien no recibe daño si el ataque que le ha visto al jugador le debilitaría sin poder responder', () => {
    const heatran = rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'flashcannon', 'earthpower', 'lavaplume'])
    const skarmory = rs('skarmory', 'leftovers', 'sturdy', ['bravebird', 'roost', 'spikes', 'whirlwind'])
    const garchomp = rs('garchomp', 'leftovers', 'roughskin', ['earthquake', 'outrage', 'swordsdance', 'stoneedge'])
    const foe = mkMon(garchomp, { moves: [{ id: 'earthquake', pp: 10, disabled: false }] })
    const state = mkState([mkMon(heatran, { hpFraction: 0.5 }), mkMon(skarmory)], [foe])
    expect(SEEDS.map((seed) => choose(state, seed))).toEqual(SEEDS.map(() => ({ type: 'switch', slot: 2 })))
  })

  it('respeta los movimientos de estado y los cambios forzados de la heurística', () => {
    const garchomp = rs('garchomp', 'leftovers', 'roughskin', ['earthquake', 'outrage', 'swordsdance', 'stoneedge'])
    const blissey = rs('blissey', 'leftovers', 'naturalcure', ['softboiled', 'seismictoss', 'toxic', 'protect'])
    const forced = mkState([mkMon(garchomp, { hp: 0, fainted: true }), mkMon(blissey)], [mkMon(blissey)], { mustSwitch: true })
    expect(choose(forced, 'x')).toEqual(chooseRivalAction(forced as never, new Prng(aiSeed('x'))))
  })
})

describe('solo lo que ha visto del jugador', () => {
  const mon = (sp: string, moves: [string, string, string, string]) => mkResolved(sp, 'leftovers', 'pressure', moves, {})
  const player = () => [mon('garchomp', ['earthquake', 'outrage', 'swordsdance', 'stoneedge']), mon('starmie', ['surf', 'icebeam', 'thunderbolt', 'recover'])]
  const rival = () => [mon('gengar', ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast']), mon('snorlax', ['bodyslam', 'earthquake', 'crunch', 'rest'])]

  it('no ve el banquillo del jugador ni su objeto, y sin ataques vistos supone uno básico de cada tipo', () => {
    const state = buildVisibleAiState(newBattle(player(), rival()))
    expect(state.foe.pokemon.map((m) => m.set.species)).toEqual(['garchomp'])
    expect(state.foe.pokemon[0].moves.map((m) => m.id)).toEqual([BASIC_ATTACKS.Dragon, BASIC_ATTACKS.Ground])
    expect(state.foe.pokemon[0].set.item).toBe('')
    // Su propio equipo lo conoce entero.
    expect(state.self.pokemon).toHaveLength(2)
  })

  it('aprende los ataques al verlos y al Pokémon que sale', () => {
    const battle = newBattle(player(), [...rival()].reverse())
    battle.makeChoices('move 1', 'move 1')
    expect(buildVisibleAiState(battle).foe.pokemon[0].moves.map((m) => m.id)).toEqual(['earthquake'])
    battle.makeChoices('switch 2', 'move 1')
    expect(buildVisibleAiState(battle).foe.pokemon.map((m) => m.set.species).sort()).toEqual(['garchomp', 'starmie'])
  })
})
