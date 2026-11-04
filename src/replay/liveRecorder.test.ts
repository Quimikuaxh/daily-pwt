import { describe, expect, it } from 'vitest'
import type { BattleClient, ClientMessage } from '../battle/client'
import { createBattleEngine } from '../battle/engine'
import type { Choice, EngineInit } from '../battle/protocol'
import { getDailyChallenge } from '../core/challenge'
import { makeGameData } from '../test-utils/fixtures'
import { firstEnabled } from '../test-utils/harness'
import type { Decision } from '../storage/gameStore'
import { LiveRecorder, type LiveSnapshot } from './liveRecorder'

// UT-149 · Directo (RF-111c, DEC-80): el motor del espectador, con las decisiones del amigo según llegan, da el mismo combate.
const data = makeGameData()
const challenge = getDailyChallenge('2026-11-04', data)

/** Cliente síncrono sobre el motor (sin worker), como el del worker pero en el mismo hilo. */
function syncClient(): BattleClient {
  let engine: ReturnType<typeof createBattleEngine> | null = null
  const listeners = new Set<(message: ClientMessage) => void>()
  const emit = (update: ReturnType<ReturnType<typeof createBattleEngine>['start']>) => listeners.forEach((listener) => listener({ type: 'update', ...update }))
  return {
    init(init: EngineInit) {
      engine = createBattleEngine(init)
      emit(engine.start())
    },
    choose: (choice: Choice) => emit(engine!.choose(choice)),
    forfeit: () => emit(engine!.forfeit()),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    terminate: () => listeners.clear(),
  }
}

/** El combate del amigo: juega la primera opción en cada turno y apunta sus decisiones y lo que vio. */
function friendBattle(seed: string, maxDecisions = 200) {
  const client = syncClient()
  const decisions: Decision[] = []
  const lines: string[][] = []
  client.subscribe((message) => {
    if (message.type !== 'update') return
    lines.push(message.lines)
    if (message.request && !message.ended && decisions.length < maxDecisions) {
      const choice = firstEnabled(message.request as never)
      decisions.push(choice)
      client.choose(choice)
    }
  })
  client.init({ battleSeed: seed, player: challenge.playerTeam, playerLead: 1, rival: challenge.rivalTeam, ai: 'heuristic', maxTurns: 300 })
  return { decisions, lines }
}

describe('motor del directo (UT-149)', () => {
  it('con las decisiones a trozos y con retraso, sale el mismo combate, hasta el final', () => {
    const friend = friendBattle('directo')
    let last: LiveSnapshot | null = null
    const recorder = new LiveRecorder(syncClient(), { challenge, seed: 'directo', ai: 'heuristic', leadIndex: 1 }, (snapshot) => {
      last = snapshot
    })
    // Antes de llegar decisiones: solo la salida al campo, esperando.
    expect(last!.steps).toHaveLength(1)
    for (let count = 1; count <= friend.decisions.length; count += 3) recorder.update(friend.decisions.slice(0, count))
    recorder.update(friend.decisions)
    expect(last!.steps.map((step) => step.lines)).toEqual(friend.lines)
    expect(last!.ended).not.toBeNull()
    expect(recorder.played).toBe(friend.decisions.length)
  })

  it('a medias se para donde llegan las decisiones; una rendición del amigo acaba el combate', () => {
    const friend = friendBattle('directo-2', 3)
    let last: LiveSnapshot | null = null
    const recorder = new LiveRecorder(syncClient(), { challenge, seed: 'directo-2', ai: 'heuristic', leadIndex: 1 }, (snapshot) => {
      last = snapshot
    })
    recorder.update(friend.decisions)
    expect(last!.steps.map((step) => step.lines)).toEqual(friend.lines)
    expect(last!.ended).toBeNull()
    recorder.update([...friend.decisions, { type: 'forfeit' }])
    expect(last!.ended).toMatchObject({ result: 'loss', reason: 'forfeit' })
  })
})
