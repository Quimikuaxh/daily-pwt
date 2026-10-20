import { describe, it, expect, vi, afterEach } from 'vitest'
import { newBattleSeed } from './seed'

// INT-03 · RF-43 · ARQUITECTURA §7: la semilla del combate sale de crypto.getRandomValues (hilo principal), nunca de Math.random.
// TODO-CONTRATO: newBattleSeed(): string en src/battle/seed.ts.
afterEach(() => vi.restoreAllMocks())

describe('newBattleSeed', () => {
  it('usa crypto.getRandomValues', () => {
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues')
    newBattleSeed()
    expect(spy).toHaveBeenCalled()
  })

  it('no usa Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    newBattleSeed()
    expect(spy).not.toHaveBeenCalled()
  })

  it('devuelve una cadena no vacía', () => {
    expect(newBattleSeed().length).toBeGreaterThan(0)
  })

  it('dos llamadas dan semillas distintas', () => {
    expect(newBattleSeed()).not.toBe(newBattleSeed())
  })

  it('100 llamadas dan 100 semillas distintas', () => {
    expect(new Set(Array.from({ length: 100 }, newBattleSeed)).size).toBe(100)
  })

  it('no depende de la hora (con el reloj congelado sigue variando)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 17))
    try {
      expect(newBattleSeed()).not.toBe(newBattleSeed())
    } finally {
      vi.useRealTimers()
    }
  })
})
