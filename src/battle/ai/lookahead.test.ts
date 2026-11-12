import { describe, expect, it } from 'vitest'
import { Prng } from '../../core/prng'
import { aiSeed, chooseRivalAction } from './heuristic'
import { chooseLookaheadAction, importance, turnScore } from './lookahead'
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

describe('cuándo cambia (Jose, 12/11/2026)', () => {
  const noDanger = { perish: null, toxicStage: 0, leechSeed: false, locked: false }
  const garchomp = rs('garchomp', 'choiceband', 'roughskin', ['earthquake', 'outrage', 'firefang', 'stoneedge'])
  const skarmory = rs('skarmory', 'leftovers', 'sturdy', ['bravebird', 'roost', 'spikes', 'whirlwind'])
  const heatran = rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'flashcannon', 'earthpower', 'lavaplume'])
  const blissey = rs('blissey', 'leftovers', 'naturalcure', ['softboiled', 'seismictoss', 'toxic', 'encore'])
  const only = (mon: ReturnType<typeof mkMon>, id: string) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move, disabled: move.id !== id })) })

  it('atada con un objeto Elección a un ataque que no hace nada, cambia', () => {
    const state = { ...mkState([only(mkMon(garchomp), 'earthquake'), mkMon(heatran)], [mkMon(skarmory)]), danger: { ...noDanger, locked: true } }
    expect(SEEDS.map((seed) => choose(state, seed))).toEqual(SEEDS.map(() => ({ type: 'switch', slot: 2 })))
  })

  it('con Otra Vez en un movimiento de estado, cambia aunque la heurística quiera usarlo', () => {
    const state = { ...mkState([only(mkMon(blissey), 'softboiled'), mkMon(heatran)], [mkMon(skarmory)]), danger: { ...noDanger, locked: true } }
    expect(choose(state, 'x')).toEqual({ type: 'switch', slot: 2 })
  })

  it('con Canto Mortal a punto de acabar, cambia', () => {
    const state = { ...mkState([mkMon(heatran), mkMon(blissey)], [mkMon(skarmory)]), danger: { ...noDanger, perish: 1 } }
    expect(choose(state, 'x')).toEqual({ type: 'switch', slot: 2 })
    // Sin la amenaza, Heatran le pega fuerte a Skarmory y se queda.
    expect(choose({ ...state, danger: noDanger }, 'x').type).toBe('move')
    // Tóxico avanzado o Drenadoras con poca vida, también.
    const hurt = mkState([mkMon(heatran, { hpFraction: 0.3 }), mkMon(blissey)], [mkMon(skarmory)])
    expect(choose({ ...hurt, danger: { ...noDanger, toxicStage: 4 } }, 'x')).toEqual({ type: 'switch', slot: 2 })
    expect(choose({ ...hurt, danger: { ...noDanger, leechSeed: true } }, 'x')).toEqual({ type: 'switch', slot: 2 })
  })

  it('si no hace casi nada y otro de su equipo planta cara, cambia a ese', () => {
    const snorlax = rs('snorlax', 'leftovers', 'thickfat', ['bodyslam', 'return', 'crunch', 'rest'])
    const foe = mkMon(skarmory, { moves: [{ id: 'bravebird', pp: 10, disabled: false }] })
    const state = { ...mkState([mkMon(snorlax), mkMon(heatran)], [foe]), danger: noDanger }
    expect(choose(state, 'x')).toEqual({ type: 'switch', slot: 2 })
  })

  // UT-204 (Jose, 12/11/2026): contra un Tauros con Cinta Elegida, Sixto cambiaba cada turno (con el motor: 22 cambios voluntarios en 6
  // combates de 8 turnos; con esto, 10). Recién entrado no vuelve a cambiar salvo que esté atado o en peligro.
  it('recién entrado no cambia aunque otro aguante mejor; atado a algo inútil, sí', () => {
    const heatran = rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'flashcannon', 'earthpower', 'lavaplume'])
    const skarmory = rs('skarmory', 'leftovers', 'sturdy', ['bravebird', 'roost', 'spikes', 'whirlwind'])
    const foe = mkMon(garchomp, { moves: [{ id: 'earthquake', pp: 10, disabled: false }] })
    const state = { ...mkState([mkMon(heatran, { hpFraction: 0.5 }), mkMon(skarmory)], [foe]), justIn: true }
    for (const seed of ['a', 'b', 'c']) expect(choose(state, seed).type).toBe('move')
    const locked = { ...state, danger: { ...noDanger, perish: 1 } }
    expect(choose(locked, 'a')).toEqual({ type: 'switch', slot: 2 })
  })

  it('el único que gana a un Pokémon del jugador es más importante, y que reciba daño pesa más', () => {
    const snorlax = rs('snorlax', 'leftovers', 'thickfat', ['bodyslam', 'return', 'crunch', 'rest'])
    const team = [mkMon(snorlax), mkMon(heatran)]
    const weights = importance(team, [mkMon(skarmory)], {})
    expect(weights.get(team[1])!).toBeGreaterThan(weights.get(team[0])!)
    const foe = mkMon(garchomp, { moves: [{ id: 'earthquake', pp: 10, disabled: false }] })
    const action = { kind: 'switch' as const, mon: team[1] }
    expect(turnScore(team[0], action, foe, 'earthquake', {}, () => 1.5)).toBeLessThan(turnScore(team[0], action, foe, 'earthquake', {}, () => 0.5))
  })

  it('decide rápido con dos equipos de seis', () => {
    const six = [garchomp, skarmory, heatran, blissey, rs('snorlax', 'leftovers', 'thickfat', ['bodyslam', 'return', 'crunch', 'rest']), rs('starmie', 'leftovers', 'naturalcure', ['surf', 'icebeam', 'thunderbolt', 'recover'])]
    const state = { ...mkState(six.map((set) => mkMon(set)), six.map((set) => mkMon(set))), danger: noDanger }
    const started = performance.now()
    choose(state, 'x')
    expect(performance.now() - started).toBeLessThan(1000)
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
