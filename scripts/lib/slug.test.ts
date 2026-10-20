import { describe, it, expect } from 'vitest'
import { importScript } from '../../src/test-utils/paths'

// ARQUITECTURA §4: scripts/lib/slug.mjs copia de claude-test/backend/src/randomizer/dexNames.ts.
// Exporta toSlug, TIPOS_ES, traduccionDerivada, SLUGS_ALTERNATIVOS.
describe('scripts/lib/slug.mjs', () => {
  it('toSlug quita apóstrofos en vez de separar (King\'s Rock -> kings-rock)', async () => {
    const { toSlug } = await importScript('scripts/lib/slug.mjs')
    expect(toSlug("King's Rock")).toBe('kings-rock')
  })

  it('toSlug separa palabras con guion y pasa a minúsculas', async () => {
    const { toSlug } = await importScript('scripts/lib/slug.mjs')
    expect(toSlug('Swords Dance')).toBe('swords-dance')
  })

  it('toSlug no deja guiones en los extremos', async () => {
    const { toSlug } = await importScript('scripts/lib/slug.mjs')
    expect(toSlug(' -Fire Blast- ')).toBe('fire-blast')
  })

  it('traduccionDerivada resuelve Hidden Power <Tipo>', async () => {
    const { traduccionDerivada } = await importScript('scripts/lib/slug.mjs')
    expect(traduccionDerivada('Hidden Power Ice')).toBe('Poder Oculto Hielo')
  })

  it('traduccionDerivada devuelve null para cualquier otro nombre', async () => {
    const { traduccionDerivada } = await importScript('scripts/lib/slug.mjs')
    expect(traduccionDerivada('Earthquake')).toBeNull()
  })

  it('traduccionDerivada devuelve null para un tipo desconocido', async () => {
    const { traduccionDerivada } = await importScript('scripts/lib/slug.mjs')
    expect(traduccionDerivada('Hidden Power Cosmic')).toBeNull()
  })

  it('SLUGS_ALTERNATIVOS cubre vise-grip -> vice-grip', async () => {
    const { SLUGS_ALTERNATIVOS } = await importScript('scripts/lib/slug.mjs')
    expect(SLUGS_ALTERNATIVOS['vise-grip']).toBe('vice-grip')
  })

  it('TIPOS_ES cubre los 17 tipos de Gen 5', async () => {
    const { TIPOS_ES } = await importScript('scripts/lib/slug.mjs')
    expect(['bug', 'dark', 'dragon', 'electric', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'normal', 'poison', 'psychic', 'rock', 'steel', 'water'].filter((t) => !TIPOS_ES[t])).toEqual([])
  })
})

describe('scripts/fetch-sprites.mjs (sin red)', () => {
  // TODO-CONTRATO: export function detectImageType(buf: Buffer): 'gif' | 'png' | null  (DEC-18: valida cabecera mágica)
  it('detecta GIF89a como gif', async () => {
    const { detectImageType } = await importScript('scripts/fetch-sprites.mjs')
    expect(detectImageType(Buffer.from('GIF89a\x01\x00'))).toBe('gif')
  })

  it('detecta la cabecera PNG', async () => {
    const { detectImageType } = await importScript('scripts/fetch-sprites.mjs')
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png')
  })

  it('rechaza una página HTML de error', async () => {
    const { detectImageType } = await importScript('scripts/fetch-sprites.mjs')
    expect(detectImageType(Buffer.from('<!DOCTYPE html><html>429</html>'))).toBeNull()
  })

  it('rechaza un buffer vacío', async () => {
    const { detectImageType } = await importScript('scripts/fetch-sprites.mjs')
    expect(detectImageType(Buffer.alloc(0))).toBeNull()
  })

  // TODO-CONTRATO: export function resolveSpriteTarget(relPath: string): string -> lanza si sale de public/sprites.
  it('solo escribe dentro de public/sprites (rechaza ../)', async () => {
    const { resolveSpriteTarget } = await importScript('scripts/fetch-sprites.mjs')
    expect(() => resolveSpriteTarget('../../etc/passwd')).toThrow()
  })

  it('acepta una ruta normal dentro de public/sprites', async () => {
    const { resolveSpriteTarget } = await importScript('scripts/fetch-sprites.mjs')
    expect(resolveSpriteTarget('pokemon/front/onix.gif')).toMatch(/public[\\/]sprites[\\/]pokemon[\\/]front[\\/]onix\.gif$/)
  })
})
