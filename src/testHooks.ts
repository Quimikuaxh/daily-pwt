import type { AiKind } from './battle/protocol'

export type TestHooks = { date?: string; seed?: string; ai?: AiKind; trainer?: string; variant?: string }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const SEED_PATTERN = /^[\w.:-]{1,64}$/

/**
 * Ganchos de prueba ?date=, ?seed=, ?ai=trivial, ?trainer=<id>[&variant=<id>] (DEC-17). Solo existen con VITE_TEST_HOOKS=1: en producción
 * la condición es constante y el bundler elimina el resto.
 */
export function readTestHooks(search: string): TestHooks {
  if (import.meta.env.VITE_TEST_HOOKS !== '1') return {}
  const params = new URLSearchParams(search)
  const date = params.get('date')
  const seed = params.get('seed')
  const trainer = params.get('trainer')
  const variant = params.get('variant')
  return {
    date: date !== null && DATE_PATTERN.test(date) ? date : undefined,
    seed: seed !== null && SEED_PATTERN.test(seed) ? seed : undefined,
    trainer: trainer !== null && ID_PATTERN.test(trainer) ? trainer : undefined,
    // Una variante sin entrenador no tiene sentido: se ignora.
    variant: trainer !== null && ID_PATTERN.test(trainer) && variant !== null && ID_PATTERN.test(variant) ? variant : undefined,
    ai: params.get('ai') === 'trivial' ? 'trivial' : undefined,
  }
}
