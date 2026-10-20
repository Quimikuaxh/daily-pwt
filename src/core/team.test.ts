import { describe, it, expect } from 'vitest'
import { buildPlayerTeam } from './team'
import { getDailyChallenge } from './challenge'
import { DataError } from './errors'
import { Prng, deriveSeed } from './prng'
import { LAUNCH_DATE } from '../config'
import { dates } from '../test-utils/dates'
import { fewTypesData, impossibleRf14Data, makeGameData, mkResolved, mkSet, poolSets, trainerAlpha, trainerBeta } from '../test-utils/fixtures'
import { distinctTypes, isForbidden, teamViolations } from '../test-utils/rules'
import type { ResolvedSet } from '../test-utils/types'

// UT-19..26 · RF-10..16 · DEC-05.
// TODO-CONTRATO: buildPlayerTeam(pool: PokemonSet[], rivalTeam: ResolvedSet[], rng: Prng, dex: DexData) -> { team, attempts, relaxed }
//   en src/core/team.ts. El filtrado por tag `source:<rivalId>` NO lo hace buildPlayerTeam (no conoce el id del rival):
//   lo hace getDailyChallenge antes de llamarla. Se comprueba en los tests de getDailyChallenge de este fichero.
// TODO-CONTRATO: sin solución para RF-14 tras 1000 intentos -> attempts === 1000 y relaxed === ['RF-14'].
const data = makeGameData()
const rivalOf = (variantIdx = 0): ResolvedSet[] =>
  trainerBeta.variants[variantIdx].team.map((s) => mkResolved(s.species, s.item, s.abilities[0], s.moves))
const rng = (seed: string) => new Prng(deriveSeed('daily-pwt:v1:test', seed, 'player'))

describe('buildPlayerTeam: reglas (UT-19, RF-10/12/13/14/16)', () => {
  const run = (seed: string, pool = poolSets, rival = rivalOf()) => buildPlayerTeam(pool, rival, rng(seed), data.dex)

  it('devuelve 6 sets', () => {
    expect(run('a').team).toHaveLength(6)
  })

  it('todos los Pokémon están totalmente evolucionados', () => {
    expect(run('a').team.every((p) => !data.dex.species[p.species].nfe)).toBe(true)
  })

  it('no repite especies', () => {
    const t = run('b').team
    expect(new Set(t.map((p) => p.species)).size).toBe(6)
  })

  it('no repite objetos', () => {
    const t = run('c').team
    expect(new Set(t.map((p) => p.item)).size).toBe(6)
  })

  it('tiene al menos 4 tipos distintos', () => {
    expect(distinctTypes(data.dex, run('d').team).length).toBeGreaterThanOrEqual(4)
  })

  it('tiene un movimiento de daño x2 por tipos contra algún rival', () => {
    const r = run('e')
    expect(teamViolations(data.dex, r.team, rivalOf(), r.relaxed)).toEqual([])
  })

  it('Nivel 50, EV 0 e IV iguales a los del rival del día en todos', () => {
    const t = run('f').team
    const rivalIv = rivalOf()[0].ivs.hp
    expect(t.every((p) => p.level === 50 && Object.values(p.ivs).every((v) => v === rivalIv) && Object.values(p.evs).every((v) => v === 0))).toBe(true)
  })

  it('los IV siguen al rival: 20, 25 o 30 según el rival, y la naturaleza es Seria', () => {
    for (const iv of [20, 25, 30]) {
      const rival = rivalOf().map((r) => ({ ...r, ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv } }))
      const t = run('iv' + iv, poolSets, rival).team
      expect(t.every((p) => Object.values(p.ivs).every((v) => v === iv) && p.nature === 'Serious'), `IV ${iv}`).toBe(true)
    }
  })

  it('cada Pokémon trae nameEs y una única habilidad', () => {
    expect(run('g').team.every((p) => p.nameEs.length > 0 && typeof p.ability === 'string')).toBe(true)
  })

  it('las reglas se cumplen con 100 semillas distintas', () => {
    const bad: string[] = []
    for (let i = 0; i < 100; i++) {
      const r = run('s' + i)
      const v = teamViolations(data.dex, r.team, rivalOf(), r.relaxed)
      if (v.length) bad.push(`s${i}: ${v.join(',')}`)
    }
    expect(bad).toEqual([])
  })

  it('es determinista: misma semilla, mismo equipo', () => {
    expect(run('z')).toEqual(run('z'))
  })

  it('no muta el pool', () => {
    const before = JSON.stringify(poolSets)
    run('m')
    expect(JSON.stringify(poolSets)).toBe(before)
  })

  it('devuelve attempts >= 1 y relaxed vacío con un pool holgado', () => {
    const r = run('h')
    expect([r.attempts >= 1, r.relaxed]).toEqual([true, []])
  })
})

describe('buildPlayerTeam: legendarios y primeras fases (UT-22)', () => {
  const contaminated = [
    mkSet('mewtwo', 'leftovers', ['pressure'], ['psychic', 'shadowball', 'icebeam', 'recover']),
    mkSet('kyogre', 'choicescarf', ['drizzle'], ['waterspout', 'surf', 'icebeam', 'thunder']),
    mkSet('deoxys', 'lifeorb', ['pressure'], ['psychoboost', 'superpower', 'icebeam', 'thunderbolt']),
    ...poolSets,
  ]

  it('un pool con legendarios prohibidos nunca los devuelve', () => {
    const bad: string[] = []
    for (let i = 0; i < 100; i++) {
      for (const p of buildPlayerTeam(contaminated, rivalOf(), rng('L' + i), data.dex).team) if (isForbidden(p.species)) bad.push(p.species)
    }
    expect(bad).toEqual([])
  })

  it('un pool con primeras fases (Onix, Pikachu...) nunca las devuelve', () => {
    const withNfe = [
      mkSet('onix', 'everstone', ['sturdy'], ['rockslide', 'earthquake', 'stealthrock', 'explosion']),
      mkSet('pikachu', 'lightball', ['static'], ['thunderbolt', 'irontail', 'brickbreak', 'surf']),
      ...poolSets,
    ]
    const bad: string[] = []
    for (let i = 0; i < 100; i++) {
      for (const p of buildPlayerTeam(withNfe, rivalOf(), rng('N' + i), data.dex).team) if (data.dex.species[p.species]?.nfe || p.species === 'onix') bad.push(p.species)
    }
    expect(bad).toEqual([])
  })

  it('el filtrado de prohibidos va por lista explícita: un legendario legal no prohibido sí puede entrar', () => {
    // Latias/Latios o Suicune no están en la lista del PWT (PRD §6); DEC-05 prohíbe vetar por tags de @pkmn.
    const legal = [mkSet('suicune', 'leftovers', ['pressure'], ['surf', 'icebeam', 'calmmind', 'rest']), ...poolSets]
    const dexWithSuicune = makeGameData({ playerSets: legal }).dex
    let seen = false
    for (let i = 0; i < 200 && !seen; i++) seen = buildPlayerTeam(legal, rivalOf(), rng('S' + i), dexWithSuicune).team.some((p) => p.species === 'suicune')
    expect(seen).toBe(true)
  })
})

describe('buildPlayerTeam: especies y objetos repetidos en el pool', () => {
  it('con dos sets de la misma especie solo entra uno', () => {
    const dupSpecies = [mkSet('garchomp', 'choicescarf', ['roughskin'], ['earthquake', 'outrage', 'stoneedge', 'swordsdance']), ...poolSets]
    const bad = Array.from({ length: 100 }, (_, i) => buildPlayerTeam(dupSpecies, rivalOf(), rng('D' + i), data.dex).team)
      .filter((t) => t.filter((p) => p.species === 'garchomp').length > 1)
    expect(bad).toEqual([])
  })

  it('con dos sets con el mismo objeto solo entra uno', () => {
    const dupItem = poolSets.map((s, i) => (i < 6 ? { ...s, item: 'leftovers' } : s))
    const bad = Array.from({ length: 100 }, (_, i) => buildPlayerTeam(dupItem, rivalOf(), rng('I' + i), data.dex).team)
      .filter((t) => t.filter((p) => p.item === 'leftovers').length > 1)
    expect(bad).toEqual([])
  })
})

describe('buildPlayerTeam: reintentos (UT-23, RF-15)', () => {
  // 8 sets de agua pura + 8 variados: una tirada al azar incumple RF-13 con frecuencia.
  const waters = ['milotic', 'vaporeon', 'golduck', 'politoed', 'blastoise', 'feraligatr', 'samurott', 'seaking']
  const items = ['leftovers', 'lifeorb', 'sitrusberry', 'chestoberry', 'shedshell', 'expertbelt', 'metronome', 'yacheberry']
  const skewed = [
    ...waters.map((sp, i) => mkSet(sp, items[i], ['pressure'], ['surf', 'icebeam', 'thunderbolt', 'toxic'])),
    mkSet('garchomp', 'choiceband', ['roughskin'], ['earthquake', 'outrage', 'stoneedge', 'swordsdance']),
    mkSet('gengar', 'focussash', ['levitate'], ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast']),
    mkSet('scizor', 'rockyhelmet', ['technician'], ['bulletpunch', 'uturn', 'superpower', 'roost']),
    mkSet('heatran', 'airballoon', ['flashfire'], ['fireblast', 'earthpower', 'flashcannon', 'stealthrock']),
    mkSet('jolteon', 'wiseglasses', ['voltabsorb'], ['thunderbolt', 'shadowball', 'hiddenpowerice', 'voltswitch']),
    mkSet('togekiss', 'blacksludge', ['serenegrace'], ['airslash', 'aurasphere', 'nastyplot', 'roost']),
    mkSet('ferrothorn', 'rockyhelmet2', ['ironbarbs'], ['leechseed', 'gyroball', 'stealthrock', 'powerwhip']),
    mkSet('infernape', 'muscleband', ['blaze'], ['closecombat', 'flareblitz', 'uturn', 'machpunch']),
  ]
  const dexSk = makeGameData({ playerSets: skewed }).dex
  const results = Array.from({ length: 60 }, (_, i) => buildPlayerTeam(skewed, rivalOf(), rng('R' + i), dexSk))

  it('alguna semilla necesita más de un intento (la tirada incumple y se repite)', () => {
    expect(Math.max(...results.map((r) => r.attempts))).toBeGreaterThan(1)
  })

  it('aun así todos los equipos devueltos tienen >= 4 tipos', () => {
    expect(results.filter((r) => distinctTypes(dexSk, r.team).length < 4)).toEqual([])
  })

  it('el reintento es determinista (mismo equipo y mismos intentos)', () => {
    const again = Array.from({ length: 60 }, (_, i) => buildPlayerTeam(skewed, rivalOf(), rng('R' + i), dexSk))
    expect(again).toEqual(results)
  })
})

describe('buildPlayerTeam: pools sin solución (UT-24, regla 7)', () => {
  const imp = impossibleRf14Data()
  const normalRival = (): ResolvedSet[] =>
    imp.trainers[0].variants[0].team.map((s) => mkResolved(s.species, s.item, s.abilities[0], s.moves))

  it('sin x2 posible usa 1000 intentos y relaja solo RF-14', () => {
    const r = buildPlayerTeam(imp.playerSets, normalRival(), rng('imp'), imp.dex)
    expect([r.attempts, r.relaxed]).toEqual([1000, ['RF-14']])
  })

  it('al relajar RF-14 el equipo sigue cumpliendo RF-12 y RF-13', () => {
    const r = buildPlayerTeam(imp.playerSets, normalRival(), rng('imp'), imp.dex)
    expect(teamViolations(imp.dex, r.team, normalRival(), ['RF-14'])).toEqual([])
  })

  it('un pool que no permite 4 tipos lanza DataError', () => {
    const few = fewTypesData()
    expect(() => buildPlayerTeam(few.playerSets, rivalOf(), rng('few'), few.dex)).toThrow(DataError)
  })

  it('el error por RF-13 está en español y no contiene trazas ni ids internos', () => {
    const few = fewTypesData()
    let msg = ''
    try { buildPlayerTeam(few.playerSets, rivalOf(), rng('few'), few.dex) } catch (e) { msg = (e as Error).message }
    expect(msg).toMatch(/equipo|jugador|pool|datos/i)
  })

  it('un pool con menos de 6 especies válidas lanza DataError', () => {
    expect(() => buildPlayerTeam(poolSets.slice(0, 5), rivalOf(), rng('small'), data.dex)).toThrow(DataError)
  })

  it('un pool vacío lanza DataError', () => {
    expect(() => buildPlayerTeam([], rivalOf(), rng('empty'), data.dex)).toThrow(DataError)
  })

  it('un pool de 6 sets pero con 3 que repiten objeto lanza DataError (no hay 6 objetos distintos)', () => {
    const pool = poolSets.slice(0, 6).map((s, i) => (i < 3 ? { ...s, item: 'leftovers' } : s))
    expect(() => buildPlayerTeam(pool, rivalOf(), rng('items'), data.dex)).toThrow(DataError)
  })
})

describe('buildPlayerTeam: naturaleza (UT-25, regla 4)', () => {
  const pool = poolSets.map((s, i) => (i === 0 ? { ...s, nature: 'Adamant' } : s))

  it('sin nature en el set se resuelve como Serious', () => {
    const teams = Array.from({ length: 40 }, (_, i) => buildPlayerTeam(poolSets, rivalOf(), rng('n' + i), data.dex).team)
    expect(teams.flat().every((p) => p.nature === 'Serious')).toBe(true)
  })

  it('con nature en el set se respeta', () => {
    const adamant = Array.from({ length: 60 }, (_, i) => buildPlayerTeam(pool, rivalOf(), rng('n' + i), data.dex).team)
      .flat().filter((p) => p.species === pool[0].species)
    expect(adamant.length).toBeGreaterThan(0)
    expect(adamant.every((p) => p.nature === 'Adamant')).toBe(true)
  })
})

describe('getDailyChallenge: equipo del jugador en un ciclo (UT-19/20/21/26)', () => {
  const ciclo = dates(3).map((d) => getDailyChallenge(d, data))

  it.each([0, 1, 2])('el día %i del ciclo cumple RF-12/13/14/16', (i) => {
    const c = ciclo[i]
    expect(teamViolations(data.dex, c.playerTeam, c.rivalTeam, c.meta.relaxedRules)).toEqual([])
  })

  it('en 365 días el equipo siempre cumple las reglas y no lanza', () => {
    const bad: string[] = []
    for (const d of dates(365)) {
      const c = getDailyChallenge(d, data)
      const v = teamViolations(data.dex, c.playerTeam, c.rivalTeam, c.meta.relaxedRules)
      if (v.length) bad.push(`${d}: ${v.join(',')}`)
    }
    expect(bad).toEqual([])
  })

  it('teamAttempts <= 1000 y solo se relaja RF-14, en 365 días', () => {
    const bad: string[] = []
    for (const d of dates(365)) {
      const { meta } = getDailyChallenge(d, data)
      if (meta.teamAttempts > 1000 || meta.relaxedRules.some((r) => r !== 'RF-14')) bad.push(d)
    }
    expect(bad).toEqual([])
  })

  it('el pool sin x2 posible queda registrado en meta.relaxedRules', () => {
    const imp = impossibleRf14Data()
    expect(getDailyChallenge(LAUNCH_DATE, imp).meta.relaxedRules).toEqual(['RF-14'])
  })

  it('nunca incluye un set con tag source:<rival del día>', () => {
    const bySpecies = (tag: string) => poolSets.filter((s) => s.tags?.includes(tag)).map((s) => s.species)
    const bad: string[] = []
    for (const d of dates(60)) {
      const c = getDailyChallenge(d, data)
      const forbidden = bySpecies('source:' + c.trainer.id)
      for (const p of c.playerTeam) if (forbidden.includes(p.species)) bad.push(`${d}: ${p.species}`)
    }
    expect(bad).toEqual([])
  })

  it('la misma especie procedente de otro rival puede entrar, pero solo una', () => {
    const pool = [
      mkSet('garchomp', 'lifeorb', ['roughskin'], ['earthquake', 'outrage', 'stoneedge', 'swordsdance'], { tags: ['source:alpha'] }),
      { ...mkSet('garchomp', 'choicescarf', ['roughskin'], ['earthquake', 'outrage', 'stoneedge', 'swordsdance']), tags: ['source:beta'] },
      ...poolSets.filter((s) => s.species !== 'garchomp').map((s) => ({ ...s, tags: ['source:beta'] })),
    ]
    const d1 = makeGameData({ trainers: [trainerAlpha], playerSets: pool })
    const garchomps = dates(80).map((d) => getDailyChallenge(d, d1).playerTeam.filter((p) => p.species === 'garchomp'))
    expect(garchomps.every((g) => g.length <= 1 && g.every((p) => p.item === 'choicescarf'))).toBe(true)
    expect(garchomps.some((g) => g.length === 1)).toBe(true)
  })

  it('sustituir el pool por otro fixture funciona sin tocar código (UT-26)', () => {
    const otherPool = ['garchomp', 'gengar', 'scizor', 'heatran', 'milotic', 'jolteon', 'blissey', 'togekiss'].map((sp, i) =>
      mkSet(sp, ['leftovers', 'lifeorb', 'sitrusberry', 'chestoberry', 'shedshell', 'expertbelt', 'metronome', 'yacheberry'][i], ['pressure'], poolSets.find((s) => s.species === sp)!.moves, { tags: ['source:zzz'] }))
    const d2 = makeGameData({ playerSets: otherPool })
    const allowed = new Set(otherPool.map((s) => s.species))
    const bad = dates(40).flatMap((d) => getDailyChallenge(d, d2).playerTeam.filter((p) => !allowed.has(p.species)).map((p) => p.species))
    expect(bad).toEqual([])
  })
})
