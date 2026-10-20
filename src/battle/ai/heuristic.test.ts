import { describe, it, expect, vi, afterEach } from 'vitest'
import { chooseRivalAction, aiSeed } from './heuristic'
import { Prng } from '../../core/prng'
import { damageRange, expectedDamage, maxHpOf } from '../../test-utils/calc'
import { mkMon, mkState, rs, slotOf, type AiMon } from '../../test-utils/ai'

// UT-36..42, UT-44 · RF-50 · PRD §9 · DEC-12. AiState manual (sin simulador).
// TODO-CONTRATO: chooseRivalAction(state: AiState, rng: Prng): Choice en src/battle/ai/heuristic.ts; aiSeed(battleSeed) === battleSeed + ':ai'.
//   AiState / Choice: ver docstring de src/test-utils/ai.ts. El activo propio es self.pokemon[0]; el del jugador, foe.pokemon[0].
// TODO-CONTRATO: "KO garantizado" = el daño mínimo sin crítico (@smogon/calc Gen 5, rango completo) >= PS actuales.
// TODO-CONTRATO: "movimiento útil" (regla 4) = ataque que no es inmune ni de daño 0, o estado/clima/stats aplicable.
// TODO-CONTRATO: si todo movimiento está sin PP/deshabilitado -> { type: 'move', slot: 1 } (Forcejeo en el sim).
const SEEDS = Array.from({ length: 20 }, (_, i) => `semilla-${i}`)
const choose = (state: any, seed: string) => chooseRivalAction(state, new Prng(aiSeed(seed)))
const forAllSeeds = (state: any) => SEEDS.map((s) => choose(state, s))
const snorlaxMoves: [string, string, string, string] = ['tackle', 'bodyslam', 'return', 'hyperbeam']

afterEach(() => vi.restoreAllMocks())

describe('regla 1: KO garantizado con más precisión (UT-36)', () => {
  const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['stoneedge', 'earthquake', 'swordsdance', 'rockslide'])
  const heatran = rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock'])

  it('entre varios KO elige el de mayor precisión (Terremoto 100 % sobre Roca Afilada 80 %)', () => {
    const state = mkState([mkMon(garchomp)], [mkMon(heatran, { hp: 1 })])
    expect(forAllSeeds(state)).toEqual(SEEDS.map(() => ({ type: 'move', slot: slotOf(state, 'earthquake') })))
  })

  it('no elige el KO impreciso si hay otro KO más preciso aunque pegue menos', () => {
    const state = mkState([mkMon(garchomp)], [mkMon(heatran, { hp: 1 })])
    expect(choose(state, 'x').slot).not.toBe(slotOf(state, 'stoneedge'))
  })

  describe('un KO solo posible con crítico no cuenta', () => {
    const skarmory = rs('skarmory', 'leftovers', 'sturdy', ['roost', 'spikes', 'bravebird', 'whirlwind'])
    const [, maxStoneEdge] = damageRange(garchomp, skarmory, 'stoneedge')
    const foeHp = maxStoneEdge + 1
    const state = mkState([mkMon(garchomp)], [mkMon(skarmory, { hp: foeHp })])

    it('precondición: ningún movimiento de Garchomp debilita sin crítico y Roca Afilada pega más (esperado) que Avalancha', () => {
      expect(maxHpOf(skarmory)).toBeGreaterThan(foeHp)
      expect(damageRange(garchomp, skarmory, 'rockslide')[1]).toBeLessThan(foeHp)
      expect(expectedDamage(garchomp, skarmory, 'stoneedge')).toBeGreaterThan(expectedDamage(garchomp, skarmory, 'rockslide'))
    })

    it('pasa a la regla 2 y elige el de mayor daño esperado, no el más preciso', () => {
      expect(forAllSeeds(state)).toEqual(SEEDS.map(() => ({ type: 'move', slot: slotOf(state, 'stoneedge') })))
    })
  })

  it('sin KO posible tampoco devuelve un movimiento de estado si hay un ataque que daña', () => {
    const state = mkState([mkMon(garchomp)], [mkMon(rs('snorlax', 'leftovers', 'immunity', snorlaxMoves))])
    expect(choose(state, 'a').slot).not.toBe(slotOf(state, 'swordsdance'))
  })
})

describe('desempate de KO (UT-37)', () => {
  const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'dragonclaw', 'swordsdance'])
  const state = mkState([mkMon(garchomp)], [mkMon(rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock']), { hp: 1 })])
  // Terremoto, Enfado y Garra Dragón: KO con 100 % de precisión.
  const tie = [1, 2, 3]

  it('siempre elige uno de los KO empatados', () => {
    expect(forAllSeeds(state).every((c) => c.type === 'move' && tie.includes(c.slot))).toBe(true)
  })

  it('con la misma semilla da siempre el mismo resultado', () => {
    expect(SEEDS.map((s) => choose(state, s))).toEqual(SEEDS.map((s) => choose(state, s)))
  })
})

describe('regla 2: mayor daño esperado (UT-38)', () => {
  it('prefiere la ventaja de tipo (Starmie con Rayo sobre Gyarados x4)', () => {
    const starmie = rs('starmie', 'leftovers', 'naturalcure', ['surf', 'icebeam', 'thunderbolt', 'psychic'])
    const gyarados = rs('gyarados', 'leftovers', 'intimidate', ['waterfall', 'earthquake', 'dragondance', 'splash'])
    const state = mkState([mkMon(starmie)], [mkMon(gyarados)])
    expect(damageRange(starmie, gyarados, 'thunderbolt')[0]).toBeLessThan(maxHpOf(gyarados)) // precondición: sin KO garantizado
    expect(forAllSeeds(state)).toEqual(SEEDS.map(() => ({ type: 'move', slot: slotOf(state, 'thunderbolt') })))
  })

  it('tiene en cuenta el STAB (Surf de Starmie sobre Rayo Hielo contra un neutro)', () => {
    const starmie = rs('starmie', 'leftovers', 'naturalcure', ['icebeam', 'surf', 'thunderwave', 'recover'])
    const snorlax = rs('snorlax', 'leftovers', 'immunity', snorlaxMoves)
    const state = mkState([mkMon(starmie)], [mkMon(snorlax)])
    const best = expectedDamage(starmie, snorlax, 'surf') > expectedDamage(starmie, snorlax, 'icebeam') ? 'surf' : 'icebeam'
    expect(choose(state, 's').slot).toBe(slotOf(state, best))
  })

  describe('clima', () => {
    const charizard = rs('charizard', 'leftovers', 'blaze', ['flamethrower', 'surf', 'roost', 'dragonpulse'])
    const snorlax = rs('snorlax', 'leftovers', 'immunity', snorlaxMoves)

    it('sin clima prefiere Lanzallamas (STAB)', () => {
      const state = mkState([mkMon(charizard)], [mkMon(snorlax)])
      expect(choose(state, 'w').slot).toBe(slotOf(state, 'flamethrower'))
    })

    it('bajo lluvia prefiere Surf', () => {
      const state = mkState([mkMon(charizard)], [mkMon(snorlax)], { weather: 'raindance' })
      expect(choose(state, 'w').slot).toBe(slotOf(state, 'surf'))
    })
  })

  it('el objeto cuenta: el rival con Globo Helio (inmune a Tierra) no recibe Terremoto', () => {
    const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'swordsdance', 'protect'])
    const heatran = rs('heatran', 'airballoon', 'flashfire', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock'])
    const state = mkState([mkMon(garchomp)], [mkMon(heatran, { hp: 50 })])
    expect(choose(state, 'b').slot).not.toBe(slotOf(state, 'earthquake'))
  })

  it('la habilidad cuenta: nunca elige una inmunidad (Terremoto sobre Gengar con Levitación)', () => {
    const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'])
    const gengar = rs('gengar', 'leftovers', 'levitate', ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast'])
    const state = mkState([mkMon(garchomp)], [mkMon(gengar)])
    expect(forAllSeeds(state).filter((c) => c.type === 'move' && c.slot === slotOf(state, 'earthquake'))).toEqual([])
  })

  it('nunca elige un movimiento deshabilitado', () => {
    const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'])
    const mon: AiMon = mkMon(garchomp)
    mon.moves[0].disabled = true
    const state = mkState([mon], [mkMon(rs('snorlax', 'leftovers', 'immunity', snorlaxMoves))])
    expect(forAllSeeds(state).filter((c) => c.type === 'move' && c.slot === 1)).toEqual([])
  })

  it('nunca elige un movimiento sin PP', () => {
    const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'])
    const mon: AiMon = mkMon(garchomp)
    mon.moves[1].pp = 0
    const state = mkState([mon], [mkMon(rs('snorlax', 'leftovers', 'immunity', snorlaxMoves))])
    expect(forAllSeeds(state).filter((c) => c.type === 'move' && c.slot === 2)).toEqual([])
  })

  it('con todos los movimientos sin PP devuelve el slot 1 (Forcejeo)', () => {
    const mon: AiMon = mkMon(rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance']))
    mon.moves.forEach((m) => { m.pp = 0 })
    const state = mkState([mon], [mkMon(rs('snorlax', 'leftovers', 'immunity', snorlaxMoves))])
    expect(choose(state, 'f')).toEqual({ type: 'move', slot: 1 })
  })

  it('devuelve siempre un slot de movimiento entre 1 y 4', () => {
    const state = mkState([mkMon(rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance']))], [mkMon(rs('snorlax', 'leftovers', 'immunity', snorlaxMoves))])
    expect(forAllSeeds(state).every((c) => c.type === 'move' && c.slot >= 1 && c.slot <= 4)).toBe(true)
  })
})

describe('regla 3: estado, clima y estadísticas (UT-39)', () => {
  // Gengar solo daña con Bomba Lodo; los movimientos Normales de Snorlax/Tyranitar/Jolteon son inmunes a Fantasma.
  const gengar = rs('gengar', 'leftovers', 'levitate', ['sludgebomb', 'willowisp', 'hypnosis', 'toxic'])
  // Los movimientos normales son inmunes a Gengar: solo el de estado es útil.
  const snorlaxSetup = rs('snorlax', 'leftovers', 'immunity', ['swordsdance', 'tackle', 'bodyslam', 'return'])

  it('usa Danza Espada cuando ningún ataque sirve y está a salvo', () => {
    const state = mkState([mkMon(snorlaxSetup)], [mkMon(gengar)])
    expect(forAllSeeds(state)).toEqual(SEEDS.map(() => ({ type: 'move', slot: 1 })))
  })

  it('precondición: Gengar no debilita a Snorlax de un golpe', () => {
    expect(damageRange(gengar, snorlaxSetup, 'sludgebomb')[1]).toBeLessThan(maxHpOf(snorlaxSetup))
  })

  it('bajo amenaza de KO ataca en lugar de potenciarse', () => {
    const attacker = rs('snorlax', 'leftovers', 'immunity', ['swordsdance', 'crunch', 'tackle', 'return'])
    const state = mkState([mkMon(attacker, { hp: 8 })], [mkMon(gengar)])
    expect(forAllSeeds(state)).toEqual(SEEDS.map(() => ({ type: 'move', slot: 2 })))
  })

  it('no repite Danza Espada con Ataque +6', () => {
    const state = mkState([mkMon(snorlaxSetup, { boosts: { atk: 6 } })], [mkMon(gengar)])
    expect(forAllSeeds(state).filter((c) => c.type === 'move' && c.slot === 1)).toEqual([])
  })

  const tyranitar = rs('tyranitar', 'leftovers', 'unnerve', ['sandstorm', 'tackle', 'bodyslam', 'return'])

  it('pone Tormenta Arena cuando no hay clima y nada más sirve', () => {
    const state = mkState([mkMon(tyranitar)], [mkMon(gengar)])
    expect(choose(state, 'c')).toEqual({ type: 'move', slot: 1 })
  })

  it('no repite Tormenta Arena si ya está activa', () => {
    const state = mkState([mkMon(tyranitar)], [mkMon(gengar)], { weather: 'sandstorm' })
    expect(forAllSeeds(state).filter((c) => c.type === 'move' && c.slot === 1)).toEqual([])
  })

  const jolteon = rs('jolteon', 'leftovers', 'voltabsorb', ['thunderwave', 'tackle', 'bodyslam', 'return'])

  it('paraliza con Onda Trueno a un rival sano', () => {
    const state = mkState([mkMon(jolteon)], [mkMon(gengar)])
    expect(choose(state, 'p')).toEqual({ type: 'move', slot: 1 })
  })

  it('no aplica estado sobre estado (rival ya paralizado)', () => {
    const state = mkState([mkMon(jolteon)], [mkMon(gengar, { status: 'par' })])
    expect(forAllSeeds(state).filter((c) => c.type === 'move' && c.slot === 1)).toEqual([])
  })
})

describe('regla 4: cambiar ante clara desventaja (UT-40)', () => {
  const gengar = rs('gengar', 'leftovers', 'levitate', ['sludgebomb', 'willowisp', 'hypnosis', 'toxic'])
  const snorlax = rs('snorlax', 'leftovers', 'immunity', snorlaxMoves) // todos sus ataques son inmunes a Gengar (Fantasma)
  const skarmory = rs('skarmory', 'leftovers', 'sturdy', ['roost', 'spikes', 'bravebird', 'whirlwind']) // Acero es inmune a Veneno (Bomba Lodo)
  const togekiss = rs('togekiss', 'wiseglasses', 'serenegrace', ['airslash', 'aurasphere', 'nastyplot', 'roost']) // neutro a Veneno
  const charizard = rs('charizard', 'leftovers', 'blaze', ['flamethrower', 'airslash', 'roost', 'dragonpulse'])
  const machamp = rs('machamp', 'leftovers', 'guts', ['closecombat', 'stoneedge', 'bulletpunch', 'payback'])
  const dying = (s = snorlax) => mkMon(s, { hp: 6 })

  it('cambia al que resiste si recibe KO y no tiene movimiento útil', () => {
    const state = mkState([dying(), mkMon(togekiss), mkMon(skarmory)], [mkMon(gengar)])
    expect(forAllSeeds(state)).toEqual(SEEDS.map(() => ({ type: 'switch', slot: 3 })))
  })

  it('el slot de switch sigue el orden de self.pokemon (resistente en la posición 2)', () => {
    const state = mkState([dying(), mkMon(skarmory), mkMon(togekiss)], [mkMon(gengar)])
    expect(choose(state, 'k')).toEqual({ type: 'switch', slot: 2 })
  })

  it('no cambia si está atrapado', () => {
    const state = mkState([dying(), mkMon(togekiss), mkMon(skarmory)], [mkMon(gengar)], { trapped: true })
    expect(forAllSeeds(state).every((c) => c.type === 'move')).toBe(true)
  })

  it('no cambia si no hay ningún resistente en el banquillo', () => {
    const state = mkState([dying(), mkMon(togekiss), mkMon(charizard), mkMon(machamp)], [mkMon(gengar)])
    expect(forAllSeeds(state).every((c) => c.type === 'move')).toBe(true)
  })

  it('no cambia al resistente si está debilitado', () => {
    const state = mkState([dying(), mkMon(togekiss), mkMon(skarmory, { hp: 0 })], [mkMon(gengar)])
    expect(forAllSeeds(state).every((c) => c.type === 'move')).toBe(true)
  })

  it('no cambia sin desventaja (PS completos: sobrevive al golpe)', () => {
    const state = mkState([mkMon(snorlax), mkMon(togekiss), mkMon(skarmory)], [mkMon(gengar)])
    expect(forAllSeeds(state).every((c) => c.type === 'move')).toBe(true)
  })

  it('no cambia si tiene un movimiento útil aunque reciba KO', () => {
    const useful = rs('snorlax', 'leftovers', 'immunity', ['crunch', 'tackle', 'bodyslam', 'return'])
    const state = mkState([dying(useful), mkMon(togekiss), mkMon(skarmory)], [mkMon(gengar)])
    expect(forAllSeeds(state).every((c) => c.type === 'move' && c.slot === 1)).toBe(true)
  })

  it('el cambio nunca apunta al propio activo (slot >= 2)', () => {
    const state = mkState([dying(), mkMon(togekiss), mkMon(skarmory)], [mkMon(gengar)])
    expect(forAllSeeds(state).filter((c) => c.type === 'switch' && c.slot < 2)).toEqual([])
  })
})

describe('regla 5: sucesor por mejor emparejamiento (UT-41)', () => {
  const gengar = rs('gengar', 'leftovers', 'levitate', ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast'])
  const tyranitar = rs('tyranitar', 'leftovers', 'unnerve', ['crunch', 'stoneedge', 'earthquake', 'pursuit'])
  const snorlax = rs('snorlax', 'leftovers', 'immunity', snorlaxMoves)
  const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance'])
  const umbreon = rs('umbreon', 'leftovers', 'synchronize', ['wish', 'protect', 'foulplay', 'toxic'])
  // Machamp solo tiene movimientos de Lucha (inmunes a Fantasma): mal emparejamiento claro. Garchomp solo hace de activo debilitado.
  const machamp = rs('machamp', 'leftovers', 'guts', ['closecombat', 'dynamicpunch', 'brickbreak', 'focusblast'])
  const faintedActive = () => mkMon(garchomp, { hp: 0 })

  it('tras un KO elige al que mejor se enfrenta al rival (Tyranitar ante Gengar)', () => {
    const state = mkState([faintedActive(), mkMon(snorlax), mkMon(machamp), mkMon(tyranitar)], [mkMon(gengar)], { mustSwitch: true })
    expect(forAllSeeds(state)).toEqual(SEEDS.map(() => ({ type: 'switch', slot: 4 })))
  })

  it('el índice sigue el orden reordenado de request.side.pokemon (mejor en la posición 2)', () => {
    const state = mkState([faintedActive(), mkMon(tyranitar), mkMon(snorlax), mkMon(machamp)], [mkMon(gengar)], { mustSwitch: true })
    expect(choose(state, 'o')).toEqual({ type: 'switch', slot: 2 })
  })

  it('nunca elige a un Pokémon debilitado aunque sea el mejor emparejamiento', () => {
    const state = mkState([faintedActive(), mkMon(tyranitar, { hp: 0 }), mkMon(snorlax), mkMon(machamp)], [mkMon(gengar)], { mustSwitch: true })
    expect(forAllSeeds(state).every((c) => c.type === 'switch' && c.slot !== 2 && c.slot !== 1)).toBe(true)
  })

  it('con un único candidato vivo lo elige', () => {
    const state = mkState([faintedActive(), mkMon(snorlax, { hp: 0 }), mkMon(umbreon)], [mkMon(gengar)], { mustSwitch: true })
    expect(choose(state, 'u')).toEqual({ type: 'switch', slot: 3 })
  })

  it('en cambio forzado siempre responde con switch, nunca con move', () => {
    const state = mkState([faintedActive(), mkMon(snorlax), mkMon(tyranitar)], [mkMon(gengar)], { mustSwitch: true })
    expect(forAllSeeds(state).every((c) => c.type === 'switch')).toBe(true)
  })
})

describe('determinismo y PRNG propio (UT-42)', () => {
  const garchomp = rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'dragonclaw', 'swordsdance'])
  const state = () => mkState([mkMon(garchomp)], [mkMon(rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock']), { hp: 1 })])

  it('el PRNG de la IA se siembra con battleSeed + ":ai"', () => {
    expect(aiSeed('abc123')).toBe('abc123:ai')
  })

  it('mismo estado y misma semilla dan la misma decisión', () => {
    expect(choose(state(), 'det')).toEqual(choose(state(), 'det'))
  })

  it('no usa Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    forAllSeeds(state())
    expect(spy).not.toHaveBeenCalled()
  })

  it('no muta el estado recibido', () => {
    const s = state()
    const before = JSON.stringify(s)
    forAllSeeds(s)
    expect(JSON.stringify(s)).toBe(before)
  })

  it('las únicas fuentes de azar son las del rng recibido (rng que devuelve siempre lo mismo da siempre lo mismo)', () => {
    const fixed = { next: () => 0.5, nextInt: (n: number) => Math.floor(0.5 * n), pick: (a: any[]) => a[Math.floor(a.length / 2)], shuffle: (a: any[]) => [...a], sample: (a: any[], n: number) => a.slice(0, n) }
    const results = Array.from({ length: 10 }, () => chooseRivalAction(state(), fixed as any))
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1)
  })
})

describe('rendimiento (UT-44)', () => {
  const t1 = ['garchomp', 'gengar', 'tyranitar', 'starmie', 'snorlax', 'heatran'] as const
  const sets = (offset: number) => t1.map((s, i) => {
    const pool = [
      rs('garchomp', 'lifeorb', 'roughskin', ['earthquake', 'outrage', 'stoneedge', 'swordsdance']),
      rs('gengar', 'leftovers', 'levitate', ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast']),
      rs('tyranitar', 'leftovers', 'unnerve', ['crunch', 'stoneedge', 'earthquake', 'pursuit']),
      rs('starmie', 'leftovers', 'naturalcure', ['surf', 'icebeam', 'thunderbolt', 'psychic']),
      rs('snorlax', 'leftovers', 'immunity', ['bodyslam', 'earthquake', 'crunch', 'rest']),
      rs('heatran', 'leftovers', 'flashfire', ['fireblast', 'earthpower', 'flashcannon', 'stealthrock']),
    ]
    return mkMon(pool[(i + offset) % 6])
  })

  it('decide en menos de 50 ms con 6 contra 6 (máximo de 20 decisiones tras calentar)', () => {
    const state = mkState(sets(0), sets(3))
    choose(state, 'warm')
    const times = SEEDS.map((s) => { const t = performance.now(); choose(state, s); return performance.now() - t })
    expect(Math.max(...times)).toBeLessThan(50)
  })

  it('decide en menos de 50 ms también en cambio forzado 6 contra 6', () => {
    const team = sets(0)
    team[0] = mkMon(team[0].set, { hp: 0 })
    const state = mkState(team, sets(2), { mustSwitch: true })
    choose(state, 'warm')
    const times = SEEDS.map((s) => { const t = performance.now(); choose(state, s); return performance.now() - t })
    expect(Math.max(...times)).toBeLessThan(50)
  })
})
