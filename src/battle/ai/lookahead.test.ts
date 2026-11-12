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

describe('lo que sabe del jugador', () => {
  const mon = (sp: string, moves: [string, string, string, string]) => mkResolved(sp, 'leftovers', 'pressure', moves, {})
  const player = () => [mon('garchomp', ['earthquake', 'outrage', 'swordsdance', 'stoneedge']), mon('starmie', ['surf', 'icebeam', 'thunderbolt', 'recover'])]
  const rival = () => [mon('snorlax', ['bodyslam', 'earthquake', 'crunch', 'rest']), mon('gengar', ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast'])]

  it('conoce el equipo entero, banquillo incluido, pero no sus objetos ni sus movimientos exactos', () => {
    const state = buildVisibleAiState(newBattle(player(), rival()))
    expect(state.foe.pokemon.map((m) => m.set.species)).toEqual(['garchomp', 'starmie'])
    expect(state.foe.pokemon.every((m) => m.set.item === '')).toBe(true)
    // Sin la lista de posibles, uno básico de cada tipo.
    expect(state.foe.pokemon[0].moves.map((m) => m.id)).toEqual([BASIC_ATTACKS.Dragon, BASIC_ATTACKS.Ground])
    expect(state.self.pokemon).toHaveLength(2)
  })

  it('predice el ataque más fuerte de cada tipo de lo que puede llevar y aprende los que le ve usar', () => {
    const pools = { garchomp: ['earthquake', 'mudshot', 'dragonclaw', 'outrage', 'swordsdance', 'firefang'], starmie: ['surf', 'watergun', 'recover'] }
    const battle = newBattle(player(), rival())
    const before = buildVisibleAiState(battle, pools)
    expect(before.foe.pokemon[0].moves.map((m) => m.id).sort()).toEqual(['earthquake', 'firefang', 'outrage'])
    expect(before.foe.pokemon[1].moves.map((m) => m.id)).toEqual(['surf'])
    battle.makeChoices('move 1', 'move 1')
    // Visto Terremoto: queda confirmado y ya no predice otro de Tierra.
    expect(buildVisibleAiState(battle, pools).foe.pokemon[0].moves.map((m) => m.id).sort()).toEqual(['earthquake', 'firefang', 'outrage'])
    expect(buildVisibleAiState(battle, pools).foe.pokemon[0].moves[0]).toMatchObject({ id: 'earthquake' })
  })
})
