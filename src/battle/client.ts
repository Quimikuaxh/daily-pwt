import { es } from '../i18n/es'
import type { CampaignClientMessage, CampaignWorkerCommand, ClientMessage, WorkerCommand } from './messages'
import type { CampaignBattleInput, CampaignBattleFinish, CampaignBattleResume, Choice, EngineInit } from './protocol'

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

/** Lo mínimo que se usa de un Worker; cada cliente limita el protocolo que acepta. */
export interface WorkerTransport<Command, Message> {
  postMessage(command: Command): void
  terminate(): void
  onmessage: ((event: MessageEvent<Message>) => void) | null
  onerror: ((event: Event) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}

export type WorkerLike = WorkerTransport<WorkerCommand, ClientMessage>
export type CampaignWorkerLike = WorkerTransport<CampaignWorkerCommand, CampaignClientMessage>
export type { CampaignClientMessage }

export interface CampaignBattleClient {
  prepare(requestId: string, input: CampaignBattleInput): void
  resume(requestId: string, input: CampaignBattleResume): void
  choose(requestId: string, battleSeed: string, choice: Choice): void
  forfeit(requestId: string, battleSeed: string): void
  finish(requestId: string, input: CampaignBattleFinish): void
  subscribe(listener: (message: CampaignClientMessage) => void): () => void
  terminate(): void
}

const createModuleWorker = <Command, Message>(): WorkerTransport<Command, Message> =>
  new Worker(new URL('./battle.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerTransport<Command, Message>

function connectWorker<Command, Message>(worker: WorkerTransport<Command, Message>, failure: () => Message) {
  const listeners = new Set<(message: Message) => void>()
  const emit = (message: Message) => listeners.forEach((listener) => listener(message))
  const emitWorkerFailure = () => emit(failure())
  worker.onmessage = (event) => emit(event.data)
  worker.onerror = emitWorkerFailure
  worker.onmessageerror = emitWorkerFailure
  return {
    send: (command: Command) => worker.postMessage(command),
    subscribe(listener: (message: Message) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    terminate() {
      listeners.clear()
      worker.terminate()
    },
  }
}

/** Cliente del reto diario; conserva los comandos y errores originales (DEC-08). */
export function createWorkerClient(createWorker: () => WorkerLike = createModuleWorker): BattleClient {
  const { send, ...connection } = connectWorker(createWorker(), () => ({ type: 'error', message: es.errors.worker } as const))
  return {
    ...connection,
    init: (init) => send({ type: 'init', init }),
    choose: (choice) => send({ type: 'choose', choice }),
    forfeit: () => send({ type: 'forfeit' }),
  }
}

/** Campaña: solo importa tipos del núcleo; el simulador y la preparación se ejecutan dentro del worker. */
export function createCampaignWorkerClient(createWorker: () => CampaignWorkerLike = createModuleWorker): CampaignBattleClient {
  // Un fallo del transporte no permite atribuir el error a una petición concreta.
  const { send, ...connection } = connectWorker(createWorker(), () => ({ type: 'campaign-error', requestId: null, message: es.errors.worker } as const))
  return {
    ...connection,
    prepare: (requestId, input) => send({ type: 'campaign-prepare', requestId, input }),
    resume: (requestId, input) => send({ type: 'campaign-resume', requestId, input }),
    choose: (requestId, battleSeed, choice) => send({ type: 'campaign-choose', requestId, battleSeed, choice }),
    forfeit: (requestId, battleSeed) => send({ type: 'campaign-forfeit', requestId, battleSeed }),
    finish: (requestId, input) => send({ type: 'campaign-finish', requestId, input }),
  }
}
