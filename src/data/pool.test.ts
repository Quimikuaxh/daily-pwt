import { describe, it, expect } from 'vitest'
import { readJson } from '../test-utils/paths'
import type { DexData, PokemonSet, Trainer } from '../test-utils/types'

// UT-35 · RF-11 · DEC-06. Pool provisional: data/player-sets.json.
const dex: DexData = readJson('src', 'generated', 'dex-gen5.json')
const pool: PokemonSet[] = readJson('data', 'player-sets.json')
const trainers: Trainer[] = readJson('data', 'trainers.json').trainers

describe('pool provisional del jugador', () => {
  it('es una lista con al menos 12 sets', () => {
    expect(pool.length).toBeGreaterThanOrEqual(12)
  })

  it('cubre al menos 8 especies distintas', () => {
    expect(new Set(pool.map((s) => s.species)).size).toBeGreaterThanOrEqual(8)
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

  it('cada set tiene al menos un tag source:<idEntrenador> de un entrenador existente', () => {
    const ids = new Set(trainers.map((t) => t.id))
    const bad = pool.filter((s) => !(s.tags ?? []).some((t) => t.startsWith('source:') && ids.has(t.slice(7))))
    expect(bad.map((s) => s.species)).toEqual([])
  })

  it('cada set del pool procede de un set real de su entrenador de origen', () => {
    const bad = pool.filter((s) => {
      const src = (s.tags ?? []).filter((t) => t.startsWith('source:')).map((t) => t.slice(7))
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
})
