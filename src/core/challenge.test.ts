import { describe, it, expect, vi, afterEach } from 'vitest'
import { challengeFor, getDailyChallenge } from './challenge'
import { DataError } from './errors'
import { Prng } from './prng'
import { deriveSeed } from './prng'
import { LAUNCH_DATE } from '../config'
import { makeGameData, trainerAlpha, trainerBeta, trainerGamma, mkSet } from '../test-utils/fixtures'
import { addDays, dates, withTZ } from '../test-utils/dates'
import type { GameData, Trainer } from '../test-utils/types'

// UT-08, 09, 14, 15, 16, 18 · RF-02..09. Datos sintéticos: 3 entrenadores (ciclo de 3 días).
// TODO-CONTRATO: getDailyChallenge vive en src/core/challenge.ts, DataError en src/core/errors.ts (mensajes en español),
//   LAUNCH_DATE se exporta de src/config.ts y getDailyChallenge lo usa (no es parámetro).
// TODO-CONTRATO: la variante se elige con UN solo nextInt(n) del flujo deriveSeed(daySeed,'variant') sobre las variantes
//   deduplicadas en el orden del JSON (daySeed = "daily-pwt:v1:"+fecha).
const data = makeGameData()
const daySeed = (d: string) => 'daily-pwt:v1:' + d

afterEach(() => vi.restoreAllMocks())

function datesOfTrainer(id: string, n: number, d: GameData = data): string[] {
  const out: string[] = []
  for (let i = 0; out.length < n && i < 20000; i++) {
    const date = addDays(LAUNCH_DATE, i)
    if (getDailyChallenge(date, d).trainer.id === id) out.push(date)
  }
  return out
}

describe('getDailyChallenge: forma y pureza (UT-08)', () => {
  it('dos llamadas iguales devuelven objetos profundamente iguales', () => {
    expect(getDailyChallenge('2026-10-17', data)).toEqual(getDailyChallenge('2026-10-17', data))
  })

  it('no llama a Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    for (const d of dates(10)) getDailyChallenge(d, data)
    expect(spy).not.toHaveBeenCalled()
  })

  it('no muta los datos de entrada', () => {
    const before = JSON.stringify(data)
    getDailyChallenge('2026-10-18', data)
    expect(JSON.stringify(data)).toBe(before)
  })

  it('incluye number, date y dataVersion', () => {
    const c = getDailyChallenge(LAUNCH_DATE, data)
    expect({ number: c.number, date: c.date, dataVersion: c.dataVersion }).toEqual({ number: 1, date: LAUNCH_DATE, dataVersion: 'test-1' })
  })

  it('incluye los campos del rival (id, nombre, categoría, región, sprite)', () => {
    const t = getDailyChallenge(LAUNCH_DATE, data).trainer
    expect(Object.keys(t)).toEqual(expect.arrayContaining(['id', 'nameEs', 'category', 'region', 'sprite']))
  })

  it('incluye la variante con torneo y url de origen', () => {
    const v = getDailyChallenge(LAUNCH_DATE, data).variant
    expect(Object.keys(v)).toEqual(expect.arrayContaining(['id', 'sourceTournament', 'sourceUrl']))
  })

  it('rivalTeam y playerTeam tienen 6 Pokémon', () => {
    const c = getDailyChallenge(LAUNCH_DATE, data)
    expect([c.rivalTeam.length, c.playerTeam.length]).toEqual([6, 6])
  })

  it('cada Pokémon resuelto tiene una sola habilidad, nivel 50 y nombre en español', () => {
    const c = getDailyChallenge(LAUNCH_DATE, data)
    for (const p of [...c.rivalTeam, ...c.playerTeam]) {
      expect(typeof p.ability).toBe('string')
      expect(p.level).toBe(50)
      expect(p.nameEs.length).toBeGreaterThan(0)
    }
  })

  it('incluye meta.teamAttempts y meta.relaxedRules', () => {
    const m = getDailyChallenge(LAUNCH_DATE, data).meta
    expect([typeof m.teamAttempts, Array.isArray(m.relaxedRules)]).toEqual(['number', true])
  })

  it('el número crece un día a día', () => {
    expect([getDailyChallenge(LAUNCH_DATE, data).number, getDailyChallenge(addDays(LAUNCH_DATE, 1), data).number]).toEqual([1, 2])
  })

  it('una fecha anterior al lanzamiento da #1 y no lanza', () => {
    expect(getDailyChallenge(addDays(LAUNCH_DATE, -3), data).number).toBe(1)
  })

  it('consumir otro PRNG (el del combate) entre llamadas no altera el reto', () => {
    const a = getDailyChallenge('2026-10-19', data)
    const battle = new Prng('battle-seed-whatever')
    for (let i = 0; i < 100; i++) battle.next()
    expect(getDailyChallenge('2026-10-19', data)).toEqual(a)
  })

  it('el rival sigue la bolsa: tres días seguidos son tres entrenadores distintos', () => {
    const ids = dates(3).map((d) => getDailyChallenge(d, data).trainer.id)
    expect(new Set(ids).size).toBe(3)
  })
})

describe('getDailyChallenge: semilla y flujos (UT-09, DEC-02)', () => {
  it('la variante sale del flujo deriveSeed("daily-pwt:v1:"+fecha, "variant")', () => {
    const ds = datesOfTrainer('alpha', 30)
    const mismatches = ds.filter((d) => {
      const expected = trainerAlpha.variants[new Prng(deriveSeed(daySeed(d), 'variant')).nextInt(2)].id
      return getDailyChallenge(d, data).variant.id !== expected
    })
    expect(mismatches).toEqual([])
  })

  it('cambiar el pool del jugador no altera rival, variante, habilidades ni inicial', () => {
    const other = makeGameData({ playerSets: [...data.playerSets].reverse() })
    const mismatches = dates(40).filter((d) => {
      const a = getDailyChallenge(d, data)
      const b = getDailyChallenge(d, other)
      return JSON.stringify([a.trainer, a.variant, a.rivalTeam]) !== JSON.stringify([b.trainer, b.variant, b.rivalTeam])
    })
    expect(mismatches).toEqual([])
  })

  it('fechas distintas pueden dar equipos del jugador distintos', () => {
    const teams = new Set(dates(30).map((d) => getDailyChallenge(d, data).playerTeam.map((p) => p.species).join(',')))
    expect(teams.size).toBeGreaterThan(5)
  })
})

describe('getDailyChallenge: variante (UT-14, RF-06)', () => {
  it('Brock-like con 2 variantes sale ~50 % cada una (±10 %) en 400 fechas', () => {
    const ds = datesOfTrainer('alpha', 400)
    const countA = ds.filter((d) => getDailyChallenge(d, data).variant.id === 'alpha-a').length
    expect(countA / 400).toBeGreaterThan(0.4)
    expect(countA / 400).toBeLessThan(0.6)
  })

  it('un entrenador con una sola variante usa siempre esa', () => {
    const ds = datesOfTrainer('beta', 30)
    expect(new Set(ds.map((d) => getDailyChallenge(d, data).variant.id))).toEqual(new Set(['beta-a']))
  })

  it('las variantes idénticas se deduplican sin sesgo (3 variantes, 2 iguales -> ~50/50)', () => {
    const dup: Trainer = {
      ...trainerAlpha,
      variants: [trainerAlpha.variants[0], { ...trainerAlpha.variants[0], id: 'alpha-a-copy', sourceTournament: 'Otro' }, trainerAlpha.variants[1]],
    }
    const d1 = makeGameData({ trainers: [dup] })
    const picks = dates(400).map((d) => getDailyChallenge(d, d1).rivalTeam.map((p) => p.species).sort().join(','))
    const shareB = picks.filter((p) => p.includes('rhyperior')).length / 400
    expect(shareB).toBeGreaterThan(0.4)
    expect(shareB).toBeLessThan(0.6)
  })
})

describe('getDailyChallenge: habilidades (UT-15, RF-07)', () => {
  const abilitiesOf = (d: string, species: string, g = data) =>
    getDailyChallenge(d, g).rivalTeam.find((p) => p.species === species)!.ability

  it('la habilidad del rival con dos opciones siempre es de la lista del set', () => {
    const ds = datesOfTrainer('beta', 60)
    expect(ds.every((d) => ['naturalcure', 'illuminate'].includes(abilitiesOf(d, 'starmie')))).toBe(true)
  })

  it('con dos opciones aparecen ambas en 200 fechas', () => {
    const ds = datesOfTrainer('beta', 200)
    expect(new Set(ds.map((d) => abilitiesOf(d, 'starmie')))).toEqual(new Set(['naturalcure', 'illuminate']))
  })

  it('es repetible para la misma fecha', () => {
    const [d] = datesOfTrainer('beta', 1)
    expect(abilitiesOf(d, 'starmie')).toBe(abilitiesOf(d, 'starmie'))
  })

  it('una habilidad única se respeta', () => {
    const [d] = datesOfTrainer('beta', 1)
    expect(abilitiesOf(d, 'gyarados')).toBe('intimidate')
  })

  it('la habilidad del jugador con dos opciones sale de la lista del set de pool', () => {
    const pool = [mkSet('gengar', 'focussash', ['levitate', 'cursedbody'], ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast']), ...data.playerSets.filter((s) => s.species !== 'gengar')]
    const g = makeGameData({ playerSets: pool })
    const seen = new Set<string>()
    for (const d of dates(300)) {
      const p = getDailyChallenge(d, g).playerTeam.find((x) => x.species === 'gengar')
      if (p) seen.add(p.ability)
    }
    expect([...seen].every((a) => ['levitate', 'cursedbody'].includes(a))).toBe(true)
  })
})

describe('getDailyChallenge: primer Pokémon rival (UT-16, RF-08)', () => {
  it.each([
    ['alpha', 'onix'],
    ['beta', 'starmie'],
  ])('%s siempre empieza con %s', (id, lead) => {
    const ds = datesOfTrainer(id, 30)
    expect(ds.every((d) => getDailyChallenge(d, data).rivalTeam[0].species === lead)).toBe(true)
  })

  it('sin regla (como Rojo) el primero varía entre fechas', () => {
    const ds = datesOfTrainer('gamma', 60)
    expect(new Set(ds.map((d) => getDailyChallenge(d, data).rivalTeam[0].species)).size).toBeGreaterThan(2)
  })

  it('sin regla el primero es reproducible', () => {
    const [d] = datesOfTrainer('gamma', 1)
    expect(getDailyChallenge(d, data).rivalTeam[0].species).toBe(getDailyChallenge(d, data).rivalTeam[0].species)
  })

  it('el equipo rival conserva sus 6 especies de la variante, reordenado', () => {
    const [d] = datesOfTrainer('gamma', 1)
    const species = getDailyChallenge(d, data).rivalTeam.map((p) => p.species).sort()
    expect(species).toEqual(trainerGamma.variants[0].team.map((s) => s.species).sort())
  })

  it('una regla alwaysLeadsWith con especie ausente lanza error de datos', () => {
    const bad = makeGameData({ trainers: [{ ...trainerBeta, alwaysLeadsWith: 'mewtwo' }] })
    expect(() => getDailyChallenge(LAUNCH_DATE, bad)).toThrow(DataError)
  })

  it('el error de datos por regla ausente está en español', () => {
    const bad = makeGameData({ trainers: [{ ...trainerBeta, alwaysLeadsWith: 'mewtwo' }] })
    expect(() => getDailyChallenge(LAUNCH_DATE, bad)).toThrow(/datos|entrenador|Pokémon/i)
  })
})

describe('getDailyChallenge: zona horaria (UT-18)', () => {
  it.each(['UTC', 'Europe/Madrid', 'Pacific/Auckland', 'America/Los_Angeles'])('misma fecha con TZ=%s da el mismo reto', (tz) => {
    const reference = withTZ('UTC', () => getDailyChallenge('2027-03-28', data))
    expect(withTZ(tz, () => getDailyChallenge('2027-03-28', data))).toEqual(reference)
  })
})

describe('getDailyChallenge: nombres (RF-21)', () => {
  it('nameEs de los Pokémon sale de names.species', () => {
    const c = getDailyChallenge(LAUNCH_DATE, data)
    for (const p of [...c.rivalTeam, ...c.playerTeam]) expect(p.nameEs).toBe(data.names.species[p.species])
  })
})

describe('challengeFor: rival y variante por id (DEC-17)', () => {
  it('devuelve el entrenador pedido sin pasar por la bolsa, en cualquier fecha', () => {
    for (const trainer of [trainerAlpha, trainerBeta, trainerGamma]) {
      for (const date of ['2020-01-01', LAUNCH_DATE, '2031-07-09']) {
        expect(challengeFor({ trainerId: trainer.id, date }, data).trainer.id).toBe(trainer.id)
      }
    }
  })

  it('es consistente con getDailyChallenge cuando el id coincide con el de la bolsa', () => {
    const daily = getDailyChallenge(LAUNCH_DATE, data)
    expect(challengeFor({ trainerId: daily.trainer.id, date: LAUNCH_DATE }, data)).toEqual(daily)
  })

  it('con variantId fuerza esa variante y sin él usa la del PRNG de la fecha', () => {
    expect(trainerAlpha.variants.length).toBeGreaterThan(1)
    for (const variant of trainerAlpha.variants) {
      expect(challengeFor({ trainerId: trainerAlpha.id, variantId: variant.id, date: LAUNCH_DATE }, data).variant.id).toBe(variant.id)
    }
  })

  it('un entrenador o una variante inexistentes lanzan DataError', () => {
    expect(() => challengeFor({ trainerId: 'nadie', date: LAUNCH_DATE }, data)).toThrow(DataError)
    expect(() => challengeFor({ trainerId: trainerAlpha.id, variantId: 'nada', date: LAUNCH_DATE }, data)).toThrow(DataError)
  })
})

// UT-82 · Apertura del lanzamiento con los datos reales (Jose, 23/10/2026): el #1 es Misty y todos los de la apertura están en el calendario.
describe('apertura del lanzamiento (LAUNCH_OPENING)', () => {
  it('con los datos reales, los primeros días son los de la apertura, en orden, y existen en el primer ciclo', async () => {
    const { loadGameData } = await import('../data/gameData')
    const { LAUNCH_OPENING } = await import('./launch')
    const real = loadGameData()
    expect(LAUNCH_OPENING[0]).toBe('misty')
    for (const id of LAUNCH_OPENING) expect(real.rosterSchedule[0].trainerIds, id).toContain(id)
    expect(LAUNCH_OPENING.map((_, i) => getDailyChallenge(addDays(LAUNCH_DATE, i), real).trainer.id)).toEqual([...LAUNCH_OPENING])
    expect(getDailyChallenge(addDays(LAUNCH_DATE, -1), real).trainer.id).toBe('misty')
  })
})
