import { describe, expect, it } from 'vitest'
import type { EngineEnd } from '../battle/protocol'
import type { NewOfficial } from '../storage/gameStore'
import { cloudDay, fakeApi, networkError, serverError } from '../test-utils/cloud'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { CloudSync, outboxKey } from './cloudSync'

// UT-97 · F4 (RF-100, RF-101, RF-104b; DEC-63 «local primero»): la cola de envíos a la base de datos.
const DATE = '2026-10-27'
const entry: NewOfficial = { date: DATE, challengeNumber: 4, trainerId: 'misty', variantId: 'misty-1', dataVersion: 'v1', startedAt: 'x', battle: { seed: 's1', ai: 'heuristic', leadIndex: 0 } }
const sizes = { player: 6, rival: 6 }
const state = (turn: number) => ({ turn, playerRemaining: 6, rivalRemaining: 6 - turn })
const move = (slot: number) => ({ type: 'move' as const, slot })
const WIN: EngineEnd = { result: 'win', reason: 'faint', turns: 3, playerAlive: 6, rivalFainted: 6, playerFainted: [false, false, false, false, false, false] }
const KEY = outboxKey('u1')

describe('CloudSync (UT-97)', () => {
  it('envía en orden: empezar, turnos y terminar', async () => {
    const api = fakeApi()
    const sync = new CloudSync(api, new MemoryStorage(), KEY)
    await sync.enqueue({ kind: 'start', entry, sizes })
    await sync.enqueue({ kind: 'turn', date: DATE, decisions: [move(0)], state: state(1) })
    await sync.enqueue({ kind: 'finish', date: DATE, ended: WIN, decisions: [move(0), move(1)] })
    expect(api.startOfficial).toHaveBeenCalledWith(entry, sizes)
    expect(api.saveTurn).toHaveBeenCalledWith(DATE, [move(0)], state(1))
    expect(api.finishOfficial).toHaveBeenCalledWith(DATE, WIN, [move(0), move(1)])
    expect(sync.pending).toBe(0)
  })

  it('sin red guarda la cola en el navegador, deja solo el último turno y la envía después (también tras recargar)', async () => {
    const storage = new MemoryStorage()
    const api = fakeApi({ startOfficial: async () => Promise.reject(networkError()) })
    const sync = new CloudSync(api, storage, KEY)
    await sync.enqueue({ kind: 'start', entry, sizes })
    await sync.enqueue({ kind: 'turn', date: DATE, decisions: [move(0)], state: state(1) })
    await sync.enqueue({ kind: 'turn', date: DATE, decisions: [move(0), move(2)], state: state(2) })
    await sync.enqueue({ kind: 'finish', date: DATE, ended: WIN, decisions: [move(0), move(2), move(3)] })
    expect(JSON.parse(storage.getItem(KEY) as string).map((op: { kind: string }) => op.kind)).toEqual(['start', 'turn', 'finish'])

    const online = fakeApi()
    const reloaded = new CloudSync(online, storage, KEY)
    await reloaded.flush()
    expect(online.saveTurn).toHaveBeenCalledTimes(1)
    expect(online.saveTurn).toHaveBeenCalledWith(DATE, [move(0), move(2)], state(2))
    expect(online.finishOfficial).toHaveBeenCalled()
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('un rechazo del servidor descarta esa llamada y sigue; si lo rechazado es el empezar, descarta todo ese día', async () => {
    const api = fakeApi({ saveTurn: async () => Promise.reject(serverError('stale_turn')) })
    const sync = new CloudSync(api, new MemoryStorage(), KEY)
    await sync.enqueue({ kind: 'start', entry, sizes })
    await sync.enqueue({ kind: 'turn', date: DATE, decisions: [move(0)], state: state(1) })
    await sync.enqueue({ kind: 'finish', date: DATE, ended: WIN, decisions: [move(0)] })
    expect(api.finishOfficial).toHaveBeenCalled()

    const rejected = fakeApi({ startOfficial: async () => Promise.reject(serverError('wrong_date')) })
    const other = new CloudSync(rejected, new MemoryStorage(), KEY)
    void other.enqueue({ kind: 'start', entry, sizes })
    void other.enqueue({ kind: 'turn', date: DATE, decisions: [move(0)], state: state(1) })
    await other.enqueue({ kind: 'finish', date: DATE, ended: WIN, decisions: [move(0)] })
    expect(rejected.saveTurn).not.toHaveBeenCalled()
    expect(rejected.finishOfficial).not.toHaveBeenCalled()
    expect(other.pending).toBe(0)
  })

  it('RF-98: si otro dispositivo ya empezó el oficial de ese día, avisa y no envía lo de este', async () => {
    const theirs = cloudDay({ date: DATE, status: 'inProgress', battle: { seed: 'otra', ai: 'heuristic', leadIndex: 1, decisions: [], checkpoint: null } })
    const api = fakeApi({ startOfficial: async () => ({ created: false, day: theirs }) })
    const started: unknown[] = []
    const sync = new CloudSync(api, new MemoryStorage(), KEY, (result) => started.push(result))
    void sync.enqueue({ kind: 'start', entry, sizes })
    await sync.enqueue({ kind: 'turn', date: DATE, decisions: [move(0)], state: state(1) })
    expect(started).toEqual([{ created: false, day: theirs }])
    expect(api.saveTurn).not.toHaveBeenCalled()
  })

  it('el mismo combate ya registrado (reintento tras un corte) sigue enviando sus turnos', async () => {
    const mine = cloudDay({ date: DATE, status: 'inProgress', battle: { seed: 's1', ai: 'heuristic', leadIndex: 0, decisions: [], checkpoint: null } })
    const api = fakeApi({ startOfficial: async () => ({ created: false, day: mine }) })
    const sync = new CloudSync(api, new MemoryStorage(), KEY)
    void sync.enqueue({ kind: 'start', entry, sizes })
    await sync.enqueue({ kind: 'turn', date: DATE, decisions: [move(0)], state: state(1) })
    expect(api.saveTurn).toHaveBeenCalled()
  })

  it('sin almacenamiento funciona en memoria', async () => {
    const api = fakeApi()
    const sync = new CloudSync(api, null, KEY)
    await sync.enqueue({ kind: 'void', date: DATE, reason: 'replayFailed' })
    expect(api.voidOfficial).toHaveBeenCalledWith(DATE, 'replayFailed')
  })
})
