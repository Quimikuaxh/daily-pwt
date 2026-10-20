import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fromRoot, readJson } from '../test-utils/paths'
import type { DexData, PokemonSet, Trainer } from '../test-utils/types'

// UT-34 · RNF-06. Los sprites de F1 existen en public/sprites con cabecera GIF/PNG válida.
// TODO-CONTRATO: public/sprites/pokemon/{front,back}/<spriteId>.gif ; public/sprites/trainers/<trainer.sprite>.gif y <trainer.sprite>-mini.png
//   (spriteId viene de dex-gen5.json: species[id].spriteId).
const dex: DexData = readJson('src', 'generated', 'dex-gen5.json')
const trainers: Trainer[] = readJson('data', 'trainers.json').trainers
const pool: PokemonSet[] = readJson('data', 'player-sets.json')
const species = [...new Set([...trainers.flatMap((t) => t.variants.flatMap((v) => v.team)), ...pool].map((s) => s.species))]

const head = (p: string, n = 8) => readFileSync(p).subarray(0, n)
const isGif = (b: Buffer) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1'))
const isPng = (b: Buffer) => b.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

describe('sprites de Pokémon', () => {
  it.each(['front', 'back'])('existe el sprite %s de cada especie usada', (side) => {
    const missing = species.filter((id) => !existsSync(fromRoot('public', 'sprites', 'pokemon', side, `${dex.species[id].spriteId}.gif`)))
    expect(missing).toEqual([])
  })

  it.each(['front', 'back'])('los sprites %s tienen cabecera GIF válida', (side) => {
    const bad = species.filter((id) => {
      const p = fromRoot('public', 'sprites', 'pokemon', side, `${dex.species[id].spriteId}.gif`)
      return existsSync(p) && !isGif(head(p) as Buffer)
    })
    expect(bad).toEqual([])
  })

  it('hay al menos un sprite (la lista de especies no está vacía)', () => {
    expect(species.length).toBeGreaterThan(8)
  })

  it('ningún sprite está vacío', () => {
    const empty = species.filter((id) => {
      const p = fromRoot('public', 'sprites', 'pokemon', 'front', `${dex.species[id].spriteId}.gif`)
      return existsSync(p) && statSync(p).size < 100
    })
    expect(empty).toEqual([])
  })
})

describe('sprites de entrenadores', () => {
  it('existe <sprite>.gif de cada entrenador de F1', () => {
    expect(trainers.filter((t) => !existsSync(fromRoot('public', 'sprites', 'trainers', `${t.sprite}.gif`))).map((t) => t.id)).toEqual([])
  })

  it('existe <sprite>-mini.png de cada entrenador de F1', () => {
    expect(trainers.filter((t) => !existsSync(fromRoot('public', 'sprites', 'trainers', `${t.sprite}-mini.png`))).map((t) => t.id)).toEqual([])
  })

  it('los .gif de entrenadores tienen cabecera GIF', () => {
    const bad = trainers.filter((t) => {
      const p = fromRoot('public', 'sprites', 'trainers', `${t.sprite}.gif`)
      return existsSync(p) && !isGif(head(p) as Buffer)
    })
    expect(bad.map((t) => t.id)).toEqual([])
  })

  it('los -mini.png tienen cabecera PNG', () => {
    const bad = trainers.filter((t) => {
      const p = fromRoot('public', 'sprites', 'trainers', `${t.sprite}-mini.png`)
      return existsSync(p) && !isPng(head(p) as Buffer)
    })
    expect(bad.map((t) => t.id)).toEqual([])
  })
})

describe('el propio comprobador de cabeceras', () => {
  it('acepta GIF89a y PNG, rechaza HTML', () => {
    expect([isGif(Buffer.from('GIF89a....')), isPng(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), isGif(Buffer.from('<html>..'))]).toEqual([true, true, false])
  })
})
