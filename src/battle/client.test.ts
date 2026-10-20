import { describe, it, expect, vi } from 'vitest'
import { createWorkerClient, type WorkerLike } from './client'
import type { ClientMessage } from './messages'
import { es } from '../i18n/es'
import { harmlessTeam } from '../test-utils/teams'

function fakeWorker() {
  const worker: WorkerLike = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null, onmessageerror: null }
  return worker
}
const update: ClientMessage = { type: 'update', lines: ['|turn|2'], view: {} as any, request: null }

describe('createWorkerClient', () => {
  it('init, choose y forfeit envían el comando al worker', () => {
    const worker = fakeWorker()
    const client = createWorkerClient(() => worker)
    const init = { battleSeed: 's', player: harmlessTeam(), rival: harmlessTeam(), ai: 'heuristic' as const, maxTurns: 300 }
    client.init(init)
    client.choose({ type: 'move', slot: 2 })
    client.forfeit()
    expect((worker.postMessage as any).mock.calls.map((c: any[]) => c[0])).toEqual([
      { type: 'init', init },
      { type: 'choose', choice: { type: 'move', slot: 2 } },
      { type: 'forfeit' },
    ])
  })

  it('reenvía a los suscriptores los mensajes del worker', () => {
    const worker = fakeWorker()
    const client = createWorkerClient(() => worker)
    const listener = vi.fn()
    client.subscribe(listener)
    worker.onmessage!({ data: update } as MessageEvent)
    expect(listener).toHaveBeenCalledWith(update)
  })

  it('la función devuelta cancela la suscripción', () => {
    const worker = fakeWorker()
    const client = createWorkerClient(() => worker)
    const listener = vi.fn()
    client.subscribe(listener)()
    worker.onmessage!({ data: update } as MessageEvent)
    expect(listener).not.toHaveBeenCalled()
  })

  it('un error del worker llega como mensaje de error en español', () => {
    const worker = fakeWorker()
    const client = createWorkerClient(() => worker)
    const listener = vi.fn()
    client.subscribe(listener)
    worker.onerror!(new Event('error'))
    expect(listener).toHaveBeenCalledWith({ type: 'error', message: es.errors.worker })
  })

  it('terminate cierra el worker y deja de avisar a los suscriptores', () => {
    const worker = fakeWorker()
    const client = createWorkerClient(() => worker)
    const listener = vi.fn()
    client.subscribe(listener)
    client.terminate()
    worker.onmessage!({ data: update } as MessageEvent)
    expect([(worker.terminate as any).mock.calls.length, listener.mock.calls.length]).toEqual([1, 0])
  })
})
