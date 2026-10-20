import { describe, it, expect } from 'vitest'
import { Prng, deriveSeed } from './prng'

// UT-01 · RF-02/03. Implementación esperada: copia íntegra de claude-test (xmur3 + sfc32).
const take = (p: Prng, n: number) => Array.from({ length: n }, () => p.next())

describe('Prng', () => {
  it('misma semilla produce la misma secuencia', () => {
    expect(take(new Prng('daily-pwt:v1:2026-10-17'), 20)).toEqual(take(new Prng('daily-pwt:v1:2026-10-17'), 20))
  })

  it('semillas distintas producen secuencias distintas', () => {
    expect(take(new Prng('a'), 10)).not.toEqual(take(new Prng('b'), 10))
  })

  it('next devuelve siempre valores en [0, 1)', () => {
    expect(take(new Prng('rango'), 2000).every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('nextInt devuelve enteros en [0, max) incluyendo los extremos', () => {
    const p = new Prng('enteros')
    const vals = Array.from({ length: 500 }, () => p.nextInt(4))
    expect(new Set(vals)).toEqual(new Set([0, 1, 2, 3]))
  })

  it('nextInt(1) devuelve siempre 0', () => {
    const p = new Prng('uno')
    expect(Array.from({ length: 20 }, () => p.nextInt(1)).every((v) => v === 0)).toBe(true)
  })

  it('nextInt lanza con máximo 0', () => {
    expect(() => new Prng('x').nextInt(0)).toThrow()
  })

  it('nextInt lanza con máximo negativo', () => {
    expect(() => new Prng('x').nextInt(-3)).toThrow()
  })

  it('pick devuelve un elemento de la lista', () => {
    expect(['a', 'b', 'c']).toContain(new Prng('p').pick(['a', 'b', 'c']))
  })

  it('pick lanza con lista vacía', () => {
    expect(() => new Prng('p').pick([])).toThrow()
  })

  it('shuffle devuelve una permutación de la lista', () => {
    const src = [1, 2, 3, 4, 5, 6, 7]
    expect([...new Prng('s').shuffle(src)].sort()).toEqual(src)
  })

  it('shuffle no muta la lista original', () => {
    const src = [1, 2, 3, 4, 5]
    new Prng('s').shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5])
  })

  it('shuffle de lista vacía devuelve lista vacía', () => {
    expect(new Prng('s').shuffle([])).toEqual([])
  })

  it('shuffle es determinista para la misma semilla', () => {
    const src = [1, 2, 3, 4, 5, 6]
    expect(new Prng('s').shuffle(src)).toEqual(new Prng('s').shuffle(src))
  })

  it('sample devuelve count elementos distintos', () => {
    expect(new Set(new Prng('m').sample([1, 2, 3, 4, 5, 6], 3)).size).toBe(3)
  })

  it('sample con count mayor que la lista devuelve todos', () => {
    expect(new Prng('m').sample([1, 2, 3], 10)).toHaveLength(3)
  })

  it('sample con count 0 devuelve lista vacía', () => {
    expect(new Prng('m').sample([1, 2, 3], 0)).toEqual([])
  })
})

describe('deriveSeed', () => {
  it('da semillas distintas por flujo (DEC-02)', () => {
    const day = 'daily-pwt:v1:2026-10-17'
    const flows = ['variant', 'abilities', 'lead', 'player'].map((f) => deriveSeed(day, f))
    expect(new Set(flows).size).toBe(4)
  })

  it('es pura: mismos argumentos, misma semilla', () => {
    expect(deriveSeed('s', 'lead')).toBe(deriveSeed('s', 'lead'))
  })

  it('distingue el orden de las partes', () => {
    expect(deriveSeed('s', 'a', 'b')).not.toBe(deriveSeed('s', 'b', 'a'))
  })

  it('un flujo derivado no coincide con la semilla base', () => {
    expect(deriveSeed('s', 'lead')).not.toBe('s')
  })
})
