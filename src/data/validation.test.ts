import { describe, it, expect } from 'vitest'
import { readJson } from '../test-utils/paths'
import { gen5, toId } from '../test-utils/dex'
import { gen5Problems } from '../test-utils/legality'
import { isForbidden } from '../test-utils/rules'
import { mkSet, makeGameData, trainerGamma } from '../test-utils/fixtures'
import { getDailyChallenge } from '../core/challenge'
import type { PokemonSet, Trainer } from '../test-utils/types'

// UT-27..31 · RF-17..20. Lee data/trainers.json y data/player-sets.json REALES.
// Formato asumido (TODO-CONTRATO): data/trainers.json = { dataVersion, rosterSchedule, trainers: Trainer[] } (PRD §8.2);
//   data/player-sets.json = PokemonSet[] con `tags`; ids de especie/objeto/habilidad/movimiento = ids de @pkmn (minúsculas).
// TODO-CONTRATO: los valores asumidos se marcan con evsAssumed: true (EV ausentes) y natureAssumed: true (sin nature).
const trainersFile = readJson('data', 'trainers.json')
const trainers: Trainer[] = trainersFile.trainers
const playerSets: PokemonSet[] = readJson('data', 'player-sets.json')
const names = readJson('src', 'generated', 'names-es.json')
const allRivalSets = trainers.flatMap((t) => t.variants.flatMap((v) => v.team))
const REGIONS = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', null]

describe('estructura (UT-27)', () => {
  it('hay 5 entrenadores de F1', () => {
    expect(trainers.map((t) => t.id).sort()).toEqual(['brock', 'camila', 'misty', 'plubio', 'rojo'])
  })

  it('Brock tiene 2 variantes (Kanto y Mundial)', () => {
    expect(trainers.find((t) => t.id === 'brock')!.variants.map((v) => v.id).sort()).toEqual(['brock-kanto-leaders', 'brock-world-leaders'])
  })

  it('todas las variantes tienen exactamente 6 Pokémon', () => {
    expect(trainers.flatMap((t) => t.variants).filter((v) => v.team.length !== 6)).toEqual([])
  })

  it('todos los sets son de nivel 50', () => {
    expect(allRivalSets.filter((s) => s.level !== 50)).toEqual([])
  })

  it('todos los sets tienen exactamente 4 movimientos', () => {
    expect(allRivalSets.filter((s) => s.moves.length !== 4)).toEqual([])
  })

  it('todos los sets tienen 1 o 2 habilidades', () => {
    expect(allRivalSets.filter((s) => s.abilities.length < 1 || s.abilities.length > 2)).toEqual([])
  })

  it('cada variante tiene sourceTournament y sourceUrl (https)', () => {
    const bad = trainers.flatMap((t) => t.variants).filter((v) => !v.sourceTournament || !/^https?:\/\//.test(v.sourceUrl))
    expect(bad).toEqual([])
  })

  it('los ids de entrenador son únicos', () => {
    expect(new Set(trainers.map((t) => t.id)).size).toBe(trainers.length)
  })

  it('los ids de variante son únicos entre todos los entrenadores', () => {
    const ids = trainers.flatMap((t) => t.variants.map((v) => v.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('categoría y región son válidas', () => {
    expect(trainers.filter((t) => !['leader', 'champion'].includes(t.category) || !REGIONS.includes(t.region as any))).toEqual([])
  })

  it('cada entrenador tiene nameEs, sprite e ivs numéricos', () => {
    expect(trainers.filter((t) => !t.nameEs || !t.sprite || typeof t.ivs !== 'number')).toEqual([])
  })

  it('alwaysLeadsWith (Brock Onix, Misty Starmie, Camila Zebstrika, Plubio Milotic) coincide con una especie de cada variante', () => {
    const lead: Record<string, string> = { brock: 'onix', misty: 'starmie', camila: 'zebstrika', plubio: 'milotic' }
    for (const [id, sp] of Object.entries(lead)) {
      const t = trainers.find((x) => x.id === id)!
      expect(t.alwaysLeadsWith).toBe(sp)
      expect(t.variants.every((v) => v.team.some((s) => s.species === sp))).toBe(true)
    }
  })

  it('Rojo no tiene alwaysLeadsWith', () => {
    expect(trainers.find((t) => t.id === 'rojo')!.alwaysLeadsWith).toBeUndefined()
  })

  it('el rosterSchedule empieza en 0 y solo referencia entrenadores existentes', () => {
    const ids = new Set(trainers.map((t) => t.id))
    expect(trainersFile.rosterSchedule[0].fromDayIndex).toBe(0)
    expect(trainersFile.rosterSchedule.flatMap((e: any) => e.trainerIds).filter((i: string) => !ids.has(i))).toEqual([])
  })

  it('las entradas del rosterSchedule caen en frontera de ciclo', () => {
    const sch = trainersFile.rosterSchedule as { fromDayIndex: number; trainerIds: string[] }[]
    let start = 0
    const bad: number[] = []
    sch.forEach((e, i) => {
      if (i > 0 && e.fromDayIndex < start) bad.push(i)
      start = e.fromDayIndex + e.trainerIds.length
      if (i + 1 < sch.length && (sch[i + 1].fromDayIndex - e.fromDayIndex) % e.trainerIds.length !== 0) bad.push(i)
    })
    expect(bad).toEqual([])
  })
})

describe('legalidad Gen 5 (UT-28)', () => {
  // Rocío Bondad (Soul Dew) es un objeto y Caída Libre (Sky Drop) un movimiento.
  const bannedIds = Object.entries({ ...names.items, ...names.moves } as Record<string, string>)
    .filter(([, es]) => es === 'Rocío Bondad' || es === 'Caída Libre').map(([id]) => id)

  it('el nombre "Rocío Bondad" y "Caída Libre" existen en names-es para poder vigilarlos', () => {
    expect(bannedIds.length).toBeGreaterThanOrEqual(2)
  })

  it('todos los sets de los rivales son legales en Gen 5', async () => {
    const problems = (await Promise.all(allRivalSets.map((s) => gen5Problems(s, bannedIds)))).flat()
    expect(problems).toEqual([])
  })

  it('todos los sets del pool del jugador son legales en Gen 5', async () => {
    const problems = (await Promise.all(playerSets.map((s) => gen5Problems(s, bannedIds)))).flat()
    expect(problems).toEqual([])
  })

  it('ningún rival usa un legendario prohibido en el PWT', () => {
    expect(allRivalSets.filter((s) => isForbidden(s.species)).map((s) => s.species)).toEqual([])
  })

  it('el validador rechaza un set de Gen 6 (Sylveon / Moonblast)', async () => {
    expect((await gen5Problems(mkSet('sylveon', 'leftovers', ['pixilate'], ['moonblast', 'hypervoice', 'wish', 'protect']))).length).toBeGreaterThan(0)
  })

  it('el validador rechaza un movimiento de Gen 6 en una especie de Gen 5', async () => {
    expect((await gen5Problems(mkSet('garchomp', 'leftovers', ['roughskin'], ['earthquake', 'moonblast', 'outrage', 'swordsdance']))).length).toBeGreaterThan(0)
  })

  it('el validador rechaza una habilidad que no es de la especie', async () => {
    expect((await gen5Problems(mkSet('garchomp', 'leftovers', ['levitate'], ['earthquake', 'outrage', 'swordsdance', 'stoneedge']))).length).toBeGreaterThan(0)
  })

  it('el validador rechaza un movimiento prohibido por el PWT', async () => {
    expect((await gen5Problems(mkSet('hydreigon', 'leftovers', ['levitate'], ['skydrop', 'dracometeor', 'darkpulse', 'roost']), ['skydrop'])).length).toBeGreaterThan(0)
  })

  it('el validador acepta un set legal', async () => {
    expect(await gen5Problems(mkSet('garchomp', 'lifeorb', ['roughskin'], ['earthquake', 'outrage', 'stoneedge', 'swordsdance']))).toEqual([])
  })
})

describe('verified (UT-29)', () => {
  it('todos los sets de los rivales tienen verified: true', () => {
    expect(allRivalSets.filter((s) => s.verified !== true).map((s) => s.species)).toEqual([])
  })

  it('todos los sets del pool tienen verified: true', () => {
    expect(playerSets.filter((s) => s.verified !== true).map((s) => s.species)).toEqual([])
  })
})

describe('IV por categoría (UT-30, RF-19)', () => {
  it('los líderes tienen IV 20', () => {
    expect(trainers.filter((t) => t.category === 'leader' && t.ivs !== 20).map((t) => t.id)).toEqual([])
  })

  it('los campeones distintos de Rojo tienen IV 25', () => {
    expect(trainers.filter((t) => t.category === 'champion' && t.id !== 'rojo' && t.ivs !== 25).map((t) => t.id)).toEqual([])
  })

  it('Rojo tiene IV 30', () => {
    expect(trainers.find((t) => t.id === 'rojo')!.ivs).toBe(30)
  })

  it('Plubio (campeón) tiene IV 25', () => {
    expect(trainers.find((t) => t.id === 'plubio')!.ivs).toBe(25)
  })

  it('los IV del entrenador llegan a los Pokémon rivales resueltos', () => {
    const d = makeGameData({ trainers: [{ ...trainerGamma, ivs: 30 }] })
    expect(getDailyChallenge('2026-10-17', d).rivalTeam.every((p) => Object.values(p.ivs).every((v) => v === 30))).toBe(true)
  })
})

describe('EV ausentes o presentes (UT-31, RF-20) y naturaleza (RF-16)', () => {
  it('todo set sin evs está marcado con evsAssumed: true', () => {
    expect(allRivalSets.filter((s) => !s.evs && (s as any).evsAssumed !== true).map((s) => s.species)).toEqual([])
  })

  it('todo set sin nature está marcado con natureAssumed: true', () => {
    expect(allRivalSets.filter((s) => !s.nature && (s as any).natureAssumed !== true).map((s) => s.species)).toEqual([])
  })

  it('un set con evs presentes no se marca como asumido', () => {
    expect(allRivalSets.filter((s) => s.evs && (s as any).evsAssumed === true)).toEqual([])
  })

  it('EV ausentes se resuelven a 0', () => {
    const d = makeGameData({ trainers: [trainerGamma] })
    expect(getDailyChallenge('2026-10-17', d).rivalTeam.every((p) => Object.values(p.evs).every((v) => v === 0))).toBe(true)
  })

  it('EV presentes se usan tal cual (y el resto a 0)', () => {
    const t = structuredClone(trainerGamma)
    t.variants[0].team.forEach((s) => { s.evs = { atk: 252, spe: 6 } })
    const r = getDailyChallenge('2026-10-17', makeGameData({ trainers: [t] })).rivalTeam
    expect(r.every((p) => p.evs.atk === 252 && p.evs.spe === 6 && p.evs.hp === 0 && p.evs.def === 0)).toBe(true)
  })

  it('un set de EV presentes y sin naturaleza resuelve a Serious', () => {
    const t = structuredClone(trainerGamma)
    t.variants[0].team.forEach((s) => { delete s.nature })
    const r = getDailyChallenge('2026-10-17', makeGameData({ trainers: [t] })).rivalTeam
    expect(r.every((p) => p.nature === 'Serious')).toBe(true)
  })

  it('una naturaleza explícita del rival se respeta', () => {
    const t = structuredClone(trainerGamma)
    t.variants[0].team.forEach((s) => { s.nature = 'Jolly' })
    const r = getDailyChallenge('2026-10-17', makeGameData({ trainers: [t] })).rivalTeam
    expect(r.every((p) => p.nature === 'Jolly')).toBe(true)
  })

  it('las especies de todos los sets existen en el dex de Gen 5', () => {
    expect(allRivalSets.filter((s) => !gen5.species.get(toId(s.species))).map((s) => s.species)).toEqual([])
  })
})
