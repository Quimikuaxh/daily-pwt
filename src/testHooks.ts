import type { AiKind } from './battle/protocol'

export type TestHooks = { date?: string; seed?: string; ai?: AiKind }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SEED_PATTERN = /^[\w.:-]{1,64}$/

/**
 * Ganchos de prueba ?date=, ?seed=, ?ai=trivial (DEC-17). Solo existen con VITE_TEST_HOOKS=1: en producción
 * la condición es constante y el bundler elimina el resto.
 */
export function readTestHooks(search: string): TestHooks {
  if (import.meta.env.VITE_TEST_HOOKS !== '1') return {}
  const params = new URLSearchParams(search)
  const date = params.get('date')
  const seed = params.get('seed')
  return {
    date: date !== null && DATE_PATTERN.test(date) ? date : undefined,
    seed: seed !== null && SEED_PATTERN.test(seed) ? seed : undefined,
    ai: params.get('ai') === 'trivial' ? 'trivial' : undefined,
  }
}
