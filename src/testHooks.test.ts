import { afterEach, describe, expect, it, vi } from 'vitest'
import { readTestHooks } from './testHooks'

afterEach(() => vi.unstubAllEnvs())

describe('ganchos de prueba ?trainer= y ?variant= (DEC-17)', () => {
  it('con VITE_TEST_HOOKS=1 lee el entrenador y la variante por id', () => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    expect(readTestHooks('?trainer=brock&variant=brock-world-leaders')).toMatchObject({ trainer: 'brock', variant: 'brock-world-leaders' })
  })

  it('una variante sin entrenador se ignora', () => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    expect(readTestHooks('?variant=brock-world-leaders')).toMatchObject({ trainer: undefined, variant: undefined })
  })

  it.each(['', '-x', 'A B', 'a/b', '../x', 'x'.repeat(65)])('un id no válido (%j) se ignora', (id) => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    expect(readTestHooks(`?trainer=${encodeURIComponent(id)}`).trainer).toBeUndefined()
  })

  it('sin VITE_TEST_HOOKS se ignoran todos los ganchos', () => {
    vi.stubEnv('VITE_TEST_HOOKS', '')
    expect(readTestHooks('?trainer=brock&variant=x&date=2026-10-19&seed=a&ai=trivial')).toEqual({})
  })
})
