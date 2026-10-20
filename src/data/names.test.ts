import { describe, it, expect } from 'vitest'
import { existsInRoot, readJson } from '../test-utils/paths'
import { gen5 } from '../test-utils/dex'
import type { NamesEs, PokemonSet, Trainer } from '../test-utils/types'

// UT-32 · RF-21 · RNF-05. Nombres en español. names-es.json = { species, moves, abilities, items, types } (claves = ids de @pkmn).
// data/names-es-overrides.json tiene la misma forma (parcial) y MANDA sobre PokeAPI.
const names: NamesEs = readJson('src', 'generated', 'names-es.json')
const trainers: Trainer[] = readJson('data', 'trainers.json').trainers
const pool: PokemonSet[] = readJson('data', 'player-sets.json')
const sets = [...trainers.flatMap((t) => t.variants.flatMap((v) => v.team)), ...pool]

const used = (sel: (s: PokemonSet) => string[]) => [...new Set(sets.flatMap(sel))]

describe('nombres en español de los datos usados', () => {
  it.each([
    ['species', (s: PokemonSet) => [s.species]],
    ['moves', (s: PokemonSet) => s.moves],
    ['abilities', (s: PokemonSet) => s.abilities],
    ['items', (s: PokemonSet) => [s.item]],
  ] as const)('todo %s usado resuelve a un nombre', (cat, sel) => {
    expect(used(sel).filter((id) => !(names as any)[cat][id])).toEqual([])
  })

  it.each(['species', 'moves', 'abilities', 'items'] as const)('ningún nombre de %s es igual a su id', (cat) => {
    const ids = Object.entries(names[cat]).filter(([id, es]) => es === id)
    // Excepción razonable: nombres que coinciden en minúsculas sin acentos (p. ej. "Onix" != "onix" porque lleva mayúscula).
    expect(ids).toEqual([])
  })

  it('los nombres de los entrenadores de F1 están en español en trainers.json', () => {
    expect(trainers.map((t) => t.nameEs)).toEqual(expect.arrayContaining(['Brock', 'Misty', 'Camila', 'Plubio', 'Rojo']))
  })

  it('los tipos tienen traducción (17 de Gen 5)', () => {
    expect(Object.keys(names.types).length).toBeGreaterThanOrEqual(17)
  })

  it('Normal -> Normal, Fire -> Fuego, Water -> Agua', () => {
    expect([names.types.Fire, names.types.Water, names.types.Steel]).toEqual(['Fuego', 'Agua', 'Acero'])
  })
})

describe('cobertura completa Gen 1-5', () => {
  it('toda especie base de Gen 5 (649) tiene nombre', () => {
    const missing = [...gen5.species].filter((s) => !s.forme && s.num >= 1 && s.num <= 649).filter((s) => !names.species[s.id])
    expect(missing.map((s) => s.id)).toEqual([])
  })

  it('toda habilidad de Gen 5 (164) tiene nombre', () => {
    expect([...gen5.abilities].filter((a) => !names.abilities[a.id]).map((a) => a.id)).toEqual([])
  })

  it('casi todos los movimientos de Gen 5 tienen nombre (solo pueden faltar los derivados no cubiertos)', () => {
    expect([...gen5.moves].filter((m) => !names.moves[m.id]).map((m) => m.id)).toEqual([])
  })

  it('casi todos los objetos de Gen 5 tienen nombre (pueden faltar Mail y Pretty Feather)', () => {
    expect([...gen5.items].filter((i) => !names.items[i.id]).length).toBeLessThanOrEqual(2)
  })

  it.each([
    'bug', 'dark', 'dragon', 'electric', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'poison', 'psychic', 'rock', 'steel', 'water',
  ])('Poder Oculto %s resuelve', (t) => {
    expect(names.moves['hiddenpower' + t]).toMatch(/^Poder Oculto /)
  })

  it('Vise Grip (Agarre) resuelve', () => {
    expect(names.moves.visegrip).toBeTruthy()
  })
})

describe('overrides manuales (DEC / ARQUITECTURA §4)', () => {
  it('existe data/names-es-overrides.json', () => {
    expect(existsInRoot('data', 'names-es-overrides.json')).toBe(true)
  })

  it('todo override prevalece en names-es.json', () => {
    const ov = readJson<Partial<NamesEs>>('data', 'names-es-overrides.json')
    const diffs: string[] = []
    for (const [cat, map] of Object.entries(ov)) {
      for (const [id, es] of Object.entries(map as Record<string, string>)) {
        if ((names as any)[cat]?.[id] !== es) diffs.push(`${cat}.${id}`)
      }
    }
    expect(diffs).toEqual([])
  })
})
