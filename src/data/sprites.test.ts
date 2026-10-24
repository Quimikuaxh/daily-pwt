import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fromRoot, importScript, readJson } from '../test-utils/paths'
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

// Algunos -mini.png de WikiDex no se han podido descargar (la app no los usa; ver TRAINER_MINIS_MISSING_ALLOWED en scripts/validate-data.mjs).
const { TRAINER_MINIS_MISSING_ALLOWED } = await importScript('scripts/validate-data.mjs')

describe('sprites de entrenadores', () => {
  it('existe <sprite>.gif de cada entrenador de F1', () => {
    expect(trainers.filter((t) => !existsSync(fromRoot('public', 'sprites', 'trainers', `${t.sprite}.gif`))).map((t) => t.id)).toEqual([])
  })

  it('existe <sprite>-mini.png de cada entrenador, salvo los de la lista de pendientes de descarga', () => {
    expect(trainers.filter((t) => !existsSync(fromRoot('public', 'sprites', 'trainers', `${t.sprite}-mini.png`)) && !TRAINER_MINIS_MISSING_ALLOWED.includes(t.sprite)).map((t) => t.id)).toEqual([])
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

// UT-80 · Lanturn sin parpadeo (PRD §0, 24/10/2026): el GIF de Showdown encendía y apagaba el halo de las antenas cada 50 ms (10 Hz,
// riesgo para personas con epilepsia fotosensible). Se dejan solo los fotogramas con halo, a 100 ms. Si se vuelve a descargar el sprite
// (`gen:sprites` solo baja los que faltan), este test avisa de que vuelve el parpadeo.
describe('sprites sin parpadeo', () => {
  /** Retardos (en centésimas) de las Graphic Control Extension del GIF. */
  const frameDelays = (buffer: Buffer): number[] => {
    const delays: number[] = []
    for (let i = 0; i + 5 < buffer.length; i += 1) {
      if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9 && buffer[i + 2] === 0x04) delays.push(buffer[i + 4] | (buffer[i + 5] << 8))
    }
    return delays
  }

  it.each(['front', 'back'])('Lanturn (%s): ningún fotograma dura menos de 100 ms', (side) => {
    const delays = frameDelays(readFileSync(fromRoot('public', 'sprites', 'pokemon', side, 'lanturn.gif')))
    expect(delays.length).toBeGreaterThan(10)
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(10)
  })
})
