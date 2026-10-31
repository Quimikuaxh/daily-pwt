import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { fromRoot, importScript, readJson } from '../src/test-utils/paths'

// UT-131 · Gritos (Jose, 31/10/2026): nombres que se prueban en Showdown e índice coherente con los ficheros.
describe('gen:cries', () => {
  it('prueba el nombre del sprite, sin guion y el de la especie base', async () => {
    const { cryCandidates } = await importScript('scripts/fetch-cries.mjs')
    expect(cryCandidates('rotom-mow')).toEqual(['rotom-mow', 'rotommow', 'rotom'])
    expect(cryCandidates('garchomp')).toEqual(['garchomp'])
  })

  it('cada grito del índice tiene su fichero en public/audio/cries', () => {
    const index: Record<string, { path: string; durationSec: number }> = readJson('src', 'generated', 'cries-index.json')
    for (const [id, entry] of Object.entries(index)) {
      expect(entry.path, id).toBe(`audio/cries/${id}.m4a`)
      expect(existsSync(fromRoot('public', entry.path)), id).toBe(true)
      expect(entry.durationSec, id).toBeGreaterThan(0)
    }
  })
})
