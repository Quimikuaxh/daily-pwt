import { describe, it, expect } from 'vitest'
import { readJson } from '../test-utils/paths'
import type { DexData, PokemonSet, Trainer } from '../test-utils/types'

// UT-35 · RF-11 · DEC-06. Pool provisional: data/player-sets.json.
const dex: DexData = readJson('src', 'generated', 'dex-gen5.json')
const pool: PokemonSet[] = readJson('data', 'player-sets.json')
const trainers: Trainer[] = readJson('data', 'trainers.json').trainers

describe('pool del jugador (Smogon Gen 5 individuales + sets de los rivales del PWT)', () => {
  it('es una lista con cientos de sets', () => {
    expect(pool.length).toBeGreaterThanOrEqual(500)
  })

  it('cubre al menos 200 especies distintas', () => {
    expect(new Set(pool.map((s) => s.species)).size).toBeGreaterThanOrEqual(200)
  })

  it('solo contiene Pokémon totalmente evolucionados', () => {
    expect(pool.filter((s) => dex.species[s.species].nfe).map((s) => s.species)).toEqual([])
  })

  it('no incluye a Onix (primera fase del rival)', () => {
    expect(pool.map((s) => s.species)).not.toContain('onix')
  })

  it('no tiene sets duplicados (misma especie, objeto, habilidades y movimientos)', () => {
    const keys = pool.map((s) => JSON.stringify([s.species, s.item, s.abilities, [...s.moves].sort(), s.nature ?? null]))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('cada set tiene al menos un tag source:<idEntrenador> de un entrenador existente o source:smogon-<tier>', () => {
    const ids = new Set(trainers.map((t) => t.id))
    const tiers = ['ubers', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu']
    const valid = (tag: string) => tag.startsWith('source:') && (ids.has(tag.slice(7)) || (tag.startsWith('source:smogon-') && tiers.includes(tag.slice(14))))
    const bad = pool.filter((s) => !(s.tags ?? []).some(valid))
    expect(bad.map((s) => s.species)).toEqual([])
  })

  it('cada set del pool procede de un set real de su entrenador de origen', () => {
    const bad = pool.filter((s) => {
      const src = (s.tags ?? []).filter((t) => t.startsWith('source:') && !t.startsWith('source:smogon-')).map((t) => t.slice(7))
      if (src.length === 0) return false
      return !src.some((id) => trainers.find((t) => t.id === id)!.variants.some((v) => v.team.some((r) => r.species === s.species)))
    })
    expect(bad.map((s) => s.species)).toEqual([])
  })

  it('todos los sets tienen nivel 50 y 4 movimientos', () => {
    expect(pool.filter((s) => s.level !== 50 || s.moves.length !== 4).map((s) => s.species)).toEqual([])
  })

  it('no contiene legendarios prohibidos del PWT', () => {
    const banned = ['mewtwo', 'lugia', 'hooh', 'kyogre', 'groudon', 'rayquaza', 'dialga', 'palkia', 'giratina', 'arceus', 'reshiram', 'zekrom', 'kyurem']
    expect(pool.filter((s) => banned.includes(s.species))).toEqual([])
  })

  it('hay sets de todos los tiers de individuales de Smogon Gen 5 y ninguno usa Caída Libre ni Rocío Bondad', () => {
    for (const tier of ['ubers', 'ou', 'uu', 'ru', 'nu']) expect(pool.some((s) => (s.tags ?? []).includes(`source:smogon-${tier}`)), tier).toBe(true)
    expect(pool.filter((s) => s.moves.includes('skydrop') || s.item === 'souldew').map((s) => s.species)).toEqual([])
  })

  it('los sets de Smogon no llevan EVs ni naturaleza (solo objeto, habilidad y movimientos) y su habilidad es de la especie', () => {
    const smogon = pool.filter((s) => (s.tags ?? []).some((tag) => tag.startsWith('source:smogon-')))
    expect(smogon.length).toBeGreaterThan(500)
    expect(smogon.filter((s) => s.evs !== undefined || s.nature !== undefined).map((s) => s.species)).toEqual([])
    const bad = smogon.filter((s) => s.abilities.some((a) => !Object.values(dex.species[s.species].abilities).map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, '')).includes(a)))
    expect(bad.map((s) => s.species)).toEqual([])
  })
})
