import { es } from '../i18n/es'
import { createBattleEngine, type BattleEngine } from './engine'
import type { BattleRequest, Choice, EngineBattleView, EngineEnd, EngineInit } from './protocol'

/** Mensajes del hilo principal al worker. */
export type WorkerCommand = { type: 'init'; init: EngineInit } | { type: 'choose'; choice: Choice } | { type: 'forfeit' }

/** Mensajes del worker al hilo principal. */
export type ClientMessage =
  | { type: 'update'; lines: string[]; view: EngineBattleView; request: BattleRequest | null; ended?: EngineEnd }
  | { type: 'error'; message: string }

/**
 * Lógica del worker sin tocar `self`: un comando entra, un mensaje sale. Así se prueba en Node y `battle.worker.ts`
 * se queda en el cableado. Los fallos del motor se convierten en un mensaje en español (sin trazas).
 */
export function createWorkerHandler(): (command: WorkerCommand) => ClientMessage {
  let engine: BattleEngine | null = null

  return (command) => {
    try {
      if (command.type === 'init') {
        engine = createBattleEngine(command.init)
        return { type: 'update', ...engine.start() }
      }
      if (!engine) return { type: 'error', message: es.errors.engine }
      const update = command.type === 'choose' ? engine.choose(command.choice) : engine.forfeit()
      return { type: 'update', ...update }
    } catch {
      return { type: 'error', message: es.errors.engine }
    }
  }
}
