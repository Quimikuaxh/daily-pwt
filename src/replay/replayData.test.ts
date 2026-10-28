import { describe, expect, it, vi } from 'vitest'
import type { BattleClient, ClientMessage } from '../battle/client'
import { getDailyChallenge } from '../core/challenge'
import { makeGameData } from '../test-utils/fixtures'
import { mkView } from '../test-utils/view'
import { ReplayClient } from './replayClient'
import { recordingClient, type ReplayData, type ReplayStep } from './replayData'
import { decodeReplay, encodeReplay } from './replayCodec'

// UT-106 · F5 (RF-120, RF-121, DEC-67): grabación de los pasos, compresión y reproductor sin worker.
const view = (turn: number) => mkView({ turn }) as ReplayStep['view']
const step = (turn: number, lines: string[] = [`|turn|${turn}`]): ReplayStep => ({ lines, view: view(turn) })

function fakeClient() {
  let listener: ((message: ClientMessage) => void) | null = null
  const client: BattleClient = {
    init: vi.fn(),
    choose: vi.fn(),
    forfeit: vi.fn(),
    terminate: vi.fn(),
    subscribe: (next) => {
      listener = next
      return () => (listener = null)
    },
  }
  return { client, emit: (message: ClientMessage) => listener?.(message) }
}

describe('recordingClient (UT-106)', () => {
  it('apunta los pasos sin la petición, los pasa a la pantalla y empieza de cero en cada init (también al reanudar)', () => {
    const inner = fakeClient()
    const recording = recordingClient(inner.client)
    const seen: ClientMessage[] = []
    recording.client.subscribe((message) => seen.push(message))
    recording.client.init({} as never)
    inner.emit({ type: 'update', lines: ['|turn|1'], view: view(1), request: { side: {} } as never })
    inner.emit({ type: 'error', message: 'x' })
    const ended = { result: 'win' as const, reason: 'faint' as const, turns: 2, playerAlive: 3, rivalFainted: 6, playerFainted: [] }
    inner.emit({ type: 'update', lines: ['|win|Jugador'], view: view(2), request: null, ended })
    expect(seen).toHaveLength(3)
    expect(recording.steps()).toEqual([{ lines: ['|turn|1'], view: view(1) }, { lines: ['|win|Jugador'], view: view(2), ended }])
    recording.client.choose({ type: 'move', slot: 2 })
    expect(inner.client.choose).toHaveBeenCalledWith({ type: 'move', slot: 2 })
    recording.client.init({} as never)
    expect(recording.steps()).toEqual([])
  })
})

describe('encodeReplay / decodeReplay (UT-106)', () => {
  it('ida y vuelta sin pérdida, comprimido', async () => {
    const data = makeGameData()
    const replay: ReplayData = {
      version: 1,
      challenge: getDailyChallenge('2026-10-29', data),
      playerLead: 1,
      battleSeed: 'seed-1',
      ai: 'heuristic',
      steps: Array.from({ length: 30 }, (_, index) => step(index + 1, [`|move|p1a: Garchomp|Earthquake|p2a: Snorlax`, `|-damage|p2a: Snorlax|40/100`, `|turn|${index + 1}`])),
      ended: null,
    }
    const encoded = await encodeReplay(replay)
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(encoded.length).toBeLessThan(JSON.stringify(replay).length / 4)
    expect(await decodeReplay(encoded)).toEqual(replay)
  })

  it('rechaza datos que no son una repetición', async () => {
    await expect(decodeReplay('no-es-base64-gzip')).rejects.toThrow()
    const empty = await encodeReplay({ version: 1, steps: [] } as unknown as ReplayData)
    await expect(decodeReplay(empty)).rejects.toThrow('replay_corrupt')
  })
})

describe('ReplayClient (UT-106)', () => {
  it('init emite el primer paso; choose y next, el siguiente; sin petición; al acabar no emite más', () => {
    const client = new ReplayClient([step(1), step(2), step(3)])
    const seen: ClientMessage[] = []
    client.subscribe((message) => seen.push(message))
    client.init()
    expect(seen).toEqual([{ type: 'update', ...step(1), request: null }])
    client.choose()
    client.next()
    expect(client.emitted).toBe(3)
    expect(client.finished).toBe(true)
    client.next()
    expect(seen).toHaveLength(3)
    client.init()
    expect(client.emitted).toBe(1)
  })
})
