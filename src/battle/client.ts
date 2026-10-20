import { es } from '../i18n/es'
import type { ClientMessage, WorkerCommand } from './messages'
import type { Choice, EngineInit } from './protocol'

export type { ClientMessage }

/** Lo que la UI ve del motor: una interfaz mínima, para sustituir el Worker por un doble en los tests. */
export interface BattleClient {
  init(init: EngineInit): void
  choose(choice: Choice): void
  forfeit(): void
  /** Devuelve la función que cancela la suscripción. */
  subscribe(listener: (message: ClientMessage) => void): () => void
  terminate(): void
}

/** Lo mínimo que se usa de un Worker; permite inyectar uno falso. */
export interface WorkerLike {
  postMessage(command: WorkerCommand): void
  terminate(): void
  onmessage: ((event: MessageEvent<ClientMessage>) => void) | null
  onerror: ((event: Event) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}

const createModuleWorker = (): WorkerLike =>
  new Worker(new URL('./battle.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike

/** Cliente sobre un Web Worker módulo (DEC-08). Un fallo del worker llega a los suscriptores como mensaje de error en español. */
export function createWorkerClient(createWorker: () => WorkerLike = createModuleWorker): BattleClient {
  const worker = createWorker()
  const listeners = new Set<(message: ClientMessage) => void>()
  const emit = (message: ClientMessage) => listeners.forEach((listener) => listener(message))
  const emitWorkerFailure = () => emit({ type: 'error', message: es.errors.worker })

  worker.onmessage = (event) => emit(event.data)
  worker.onerror = emitWorkerFailure
  worker.onmessageerror = emitWorkerFailure

  return {
    init: (init) => worker.postMessage({ type: 'init', init }),
    choose: (choice) => worker.postMessage({ type: 'choose', choice }),
    forfeit: () => worker.postMessage({ type: 'forfeit' }),
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    terminate() {
      listeners.clear()
      worker.terminate()
    },
  }
}
