import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBattle, type BattleParams } from './useBattle'
import type { BattleClient, ClientMessage } from '../battle/client'
import { createWorkerHandler } from '../battle/messages'
import type { EngineEnd, EngineInit } from '../battle/protocol'
import { attackers } from '../test-utils/teams'
import { settle } from '../test-utils/ui'
import { makeGameData } from '../test-utils/fixtures'
import type { Decision } from '../storage/gameStore'

// DEC-43: reanudar = reproducir las decisiones guardadas sobre el motor real (determinista dado battleSeed), sin intro ni pausas.
const data = makeGameData()
const INIT: EngineInit = { battleSeed: 'replay-seed', player: attackers(), playerLead: 0, rival: attackers().reverse(), ai: 'heuristic', maxTurns: 300 }

/** Cliente sobre el motor real: igual que el worker pero en el mismo hilo, entregando cada mensaje en el siguiente ciclo. */
function engineClient(): BattleClient {
  const handler = createWorkerHandler()
  const listeners = new Set<(message: ClientMessage) => void>()
  const deliver = (message: ClientMessage) => setTimeout(() => act(() => listeners.forEach((listener) => listener(message))), 0)
  return {
    init: (init) => void deliver(handler({ type: 'init', init })),
    choose: (choice) => void deliver(handler({ type: 'choose', choice })),
    forfeit: () => void deliver(handler({ type: 'forfeit' })),
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    terminate: () => listeners.clear(),
  }
}

type Overrides = Partial<Pick<BattleParams, 'replay' | 'onDecision' | 'onSettled' | 'onReplayFailed' | 'onFinish' | 'playSfx'>>
function mount(over: Overrides = {}) {
  const params: BattleParams = {
    client: engineClient(),
    init: INIT,
    translateContext: { names: data.names, trainer: { nameEs: 'Rival', category: 'leader', gender: 'M' } },
    intro: { rivalLead: 'Rival', playerLead: 'Jugador' },
    onFinish: vi.fn(),
    ...over,
  }
  return { ...renderHook(() => useBattle(params)), params }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

async function playLive(turns: number) {
  const decisions: Decision[] = []
  const settled: { turn: number; playerRemaining: number; rivalRemaining: number }[] = []
  const live = mount({ onDecision: (decision) => decisions.push(decision), onSettled: (state) => settled.push(state) })
  await settle(8000)
  for (let turn = 0; turn < turns; turn += 1) {
    act(() => live.result.current.choose({ type: 'move', slot: 1 }))
    await settle(12_000)
  }
  return { live, decisions, settled }
}

describe('reproducción de un combate guardado (DEC-43)', () => {
  it('deja el mismo estado, la misma petición y el mismo historial que el combate en vivo, sin intro', async () => {
    const { live, decisions, settled } = await playLive(3)
    expect(decisions).toHaveLength(3)
    expect(live.result.current.introPhase).toBe('done')

    const replayed = mount({ replay: { decisions, expected: settled.at(-1)! } })
    await settle(50)

    expect(replayed.result.current.introPhase).toBe('done')
    expect(replayed.result.current.canAct).toBe(true)
    expect(replayed.result.current.view).toEqual(live.result.current.view)
    expect(replayed.result.current.request).toEqual(live.result.current.request)
    expect(replayed.result.current.log).toEqual(live.result.current.log)
    expect(replayed.params.onReplayFailed).toBeUndefined()
  })

  it('no repite la intro: la fase es done desde el primer momento', async () => {
    const { decisions } = await playLive(1)
    const replayed = mount({ replay: { decisions, expected: null } })
    expect(replayed.result.current.introPhase).toBe('done')
  })

  it('no vuelve a notificar las decisiones reproducidas (no se duplican en el guardado)', async () => {
    const { decisions } = await playLive(2)
    const onDecision = vi.fn()
    mount({ replay: { decisions, expected: null }, onDecision })
    await settle(50)
    expect(onDecision).not.toHaveBeenCalled()
  })

  it('se puede seguir jugando tras reanudar: la siguiente decisión se notifica y avanza el turno', async () => {
    const { live, decisions } = await playLive(2)
    const onDecision = vi.fn()
    const replayed = mount({ replay: { decisions, expected: null }, onDecision })
    await settle(50)
    const requestBefore = replayed.result.current.request
    // Tras el último golpe puede tocar cambio forzado: se contesta con lo que pida el motor.
    const next: Decision = requestBefore?.forceSwitch ? { type: 'switch', slot: 2 } : { type: 'move', slot: 1 }
    act(() => replayed.result.current.choose({ type: next.type as 'move' | 'switch', slot: (next as { slot: number }).slot }))
    await settle(12_000)
    expect(onDecision).toHaveBeenCalledWith(next)
    expect(replayed.result.current.failed).toBe(false)
    expect(replayed.result.current.request).not.toEqual(requestBefore)
    expect(live.result.current.request).toEqual(requestBefore)
  })

  it('si el estado alcanzado no es el guardado, avisa de que no se puede reanudar', async () => {
    const { decisions, settled } = await playLive(2)
    const onReplayFailed = vi.fn()
    mount({ replay: { decisions, expected: { ...settled.at(-1)!, turn: settled.at(-1)!.turn + 1 } }, onReplayFailed })
    await settle(50)
    expect(onReplayFailed).toHaveBeenCalledTimes(1)
  })

  it('una decisión que el motor rechaza (datos cambiados) hace fallar la reproducción', async () => {
    const onReplayFailed = vi.fn()
    mount({ replay: { decisions: [{ type: 'move', slot: 9 }], expected: null }, onReplayFailed })
    await settle(50)
    expect(onReplayFailed).toHaveBeenCalledTimes(1)
  })

  it('un combate que termina antes de la última decisión guardada es una reproducción fallida', async () => {
    const onReplayFailed = vi.fn()
    const tooMany: Decision[] = [{ type: 'forfeit' }, { type: 'move', slot: 1 }]
    mount({ replay: { decisions: tooMany, expected: null }, onReplayFailed })
    await settle(50)
    expect(onReplayFailed).toHaveBeenCalledTimes(1)
  })

  it('si la última decisión guardada acaba el combate (rendición o golpe final), se reanuda hasta el resultado', async () => {
    const onFinish = vi.fn<(ended: EngineEnd) => void>()
    mount({ replay: { decisions: [{ type: 'forfeit' }], expected: null }, onFinish })
    await settle(5000)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ result: 'loss', reason: 'forfeit' }))
  })

  it('el registro de decisiones del jugador incluye la rendición', async () => {
    const decisions: Decision[] = []
    const live = mount({ onDecision: (decision) => decisions.push(decision) })
    await settle(8000)
    act(() => live.result.current.forfeit())
    await settle(5000)
    expect(decisions).toEqual([{ type: 'forfeit' }])
  })
})

// UT-78 · Efectos de sonido del combate (DEC-57): suenan en vivo y nunca al reproducir.
describe('efectos de sonido del combate', () => {
  it('en vivo: las dos Poké Ball de la intro (lanzar y abrir) y un golpe por cada daño de movimiento', async () => {
    const playSfx = vi.fn()
    const live = mount({ playSfx })
    await settle(8000)
    const intro = playSfx.mock.calls.map(([id]) => id)
    expect(intro).toEqual(['ball-throw', 'ball-open', 'ball-throw', 'ball-open'])
    act(() => live.result.current.choose({ type: 'move', slot: 1 }))
    await settle(12_000)
    const hits = playSfx.mock.calls.map(([id]) => id).filter((id) => id.startsWith('hit-'))
    const damage = live.result.current.log.filter((text) => /usó|ha usado/.test(text)).length
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.length).toBeLessThanOrEqual(damage * 5)
  })

  it('al reproducir un combate guardado no suena nada', async () => {
    const { decisions, settled } = await playLive(2)
    const playSfx = vi.fn()
    mount({ replay: { decisions, expected: settled.at(-1)! }, playSfx })
    await settle(50)
    expect(playSfx).not.toHaveBeenCalled()
  })
})
