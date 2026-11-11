import { describe, expect, it, vi } from 'vitest'
import { createCampaignWorkerClient, createWorkerClient, type CampaignWorkerLike, type WorkerLike } from './client'
import { createWorkerHandler, type BattleWorkerCommand, type BattleWorkerMessage, type CampaignClientMessage, type CampaignWorkerCommand } from './messages'
import type { CampaignBattleInput } from './protocol'
import { beginCampaignBattle, finishCampaignBattle, type CampaignBattleDefinition } from '../core/nuzlocke/battle'
import { createCampaign } from '../core/nuzlocke/campaign'
import { createBattleEngine } from './engine'
import { firstEnabled } from '../test-utils/harness'
import { harmlessTeam } from '../test-utils/teams'
import { readJson } from '../test-utils/paths'
import { es } from '../i18n/es'

const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
const definition = { encounters, species }
const input = (move = 'absorb'): CampaignBattleInput => ({ definition,
  state: { ...createCampaign('campaign-worker'), phase: 'prepare',
    members: [{ id: 'starter', species: 'treecko', level: 15, history: [], fainted: false, victories: 0 }] },
  preparation: { unlockedMoves: [], movesByMember: { starter: [move] }, leadId: 'starter' }, selected: ['starter'],
})
const prepare = (value = input(), requestId = 'prepare'): CampaignWorkerCommand => ({ type: 'campaign-prepare', requestId, input: value })
const prepared = (message: CampaignClientMessage) => {
  expect(message.type).toBe('campaign-prepared')
  if (message.type !== 'campaign-prepared') throw new Error('No se preparó el combate')
  return message
}
const error = (requestId: string) => ({ type: 'campaign-error', requestId, message: es.errors.engine })

function transport(handle = createWorkerHandler()): CampaignWorkerLike {
  return { onmessage: null, onerror: null, onmessageerror: null, terminate: vi.fn(),
    postMessage(command) {
      this.onmessage?.({ data: structuredClone(handle(structuredClone(command))) } as MessageEvent<CampaignClientMessage>)
    } }
}

describe('campaña por el mismo worker de combate', () => {
  it('prepara, juega y aplica el resultado por el cliente sin mutar el estado del hilo principal', () => {
    const client = createCampaignWorkerClient(() => transport())
    const messages: CampaignClientMessage[] = []
    client.subscribe(message => messages.push(message))
    const original = input()
    const before = structuredClone(original)
    client.prepare('begin', JSON.parse(JSON.stringify(original)))
    const start = prepared(messages.at(-1)!)
    const expected = beginCampaignBattle(definition, original.state,
      { ...original.preparation, unlockedMoves: new Set() }, original.selected)
    expect(start).toMatchObject({ requestId: 'begin', ...expected })
    expect(start.init.generation).toBe(3)
    expect(start.update.lines).toContain('|gen|3')
    expect(start.update.lines).toContain('|gametype|singles')
    expect(start.update.lines.join('\n')).not.toMatch(/teampreview/)
    expect(start.update.request?.active?.[0].moves.map(move => move.id)).toEqual(['absorb'])
    expect(start.update.view.rival.team.map(mon => mon.species)).toEqual(['geodude', 'geodude', 'nosepass'])
    expect(start.update.request?.side.pokemon[0].details).toContain('L15')
    const direct = createBattleEngine(start.init)
    expect(start.update).toEqual(direct.start())
    let update = start.update
    let count = 0
    while (!update.ended && count < 300) {
      const choice = firstEnabled(update.request!)
      client.choose(`move-${count++}`, start.init.battleSeed, choice)
      const response = messages.at(-1)!
      expect(response.type).toBe('campaign-update')
      if (response.type !== 'campaign-update') throw new Error('No avanzó el combate')
      expect(response.requestId).toBe(`move-${count - 1}`)
      update = response.update
      expect(update).toEqual(direct.choose(choice))
    }
    expect(update.ended).toBeDefined()
    const finishInput = { definition, state: start.state, battleSeed: start.init.battleSeed }
    client.finish('finish', finishInput)
    expect(messages.at(-1)).toEqual({ type: 'campaign-finished', requestId: 'finish',
      battleSeed: start.init.battleSeed, ended: update.ended,
      state: finishCampaignBattle(definition, start.state, update.ended!, start.init.battleSeed) })
    expect(original).toEqual(before)
    expect(start.state.phase).toBe('battle')
    client.finish('duplicate', finishInput)
    expect(messages.at(-1)).toEqual(error('duplicate'))
  })

  it('aplica las bajas en el orden de entrada aunque se cambie el inicial entre dos miembros de la misma especie', () => {
    const handle = createWorkerHandler()
    const value = input()
    value.state.members = ['fish-a', 'fish-b'].map(id => ({ id, species: 'magikarp', level: 15, history: [], fainted: false, victories: 0 }))
    value.selected = ['fish-a', 'fish-b']
    value.preparation = { unlockedMoves: [], movesByMember: { 'fish-a': ['splash'], 'fish-b': ['splash'] }, leadId: 'fish-b' }
    const start = prepared(handle(prepare(value)))
    let update = start.update
    for (let count = 0; count < 100 && !update.request?.forceSwitch && !update.ended; count++) {
      const response = handle({ type: 'campaign-choose', requestId: `hit-${count}`, battleSeed: start.init.battleSeed, choice: firstEnabled(update.request!) })
      if (response.type !== 'campaign-update') throw new Error('No avanzó el combate')
      update = response.update
    }
    expect(update.request?.forceSwitch).toEqual([true])
    const end = handle({ type: 'campaign-forfeit', requestId: 'quit', battleSeed: start.init.battleSeed })
    expect(end).toMatchObject({ type: 'campaign-update', update: { ended: { playerFainted: [false, true] } } })
    const finished = handle({ type: 'campaign-finish', requestId: 'finish', input: { definition, state: start.state, battleSeed: start.init.battleSeed } })
    expect(finished.type).toBe('campaign-finished')
    if (finished.type !== 'campaign-finished') throw new Error('No cerró el combate')
    expect(finished.state.members.map(member => [member.id, member.fainted])).toEqual([['fish-a', false], ['fish-b', true]])
  })

  it('rechaza resultados atrasados de otra preparación del mismo encuentro', () => {
    const handle = createWorkerHandler()
    const a = prepared(handle(prepare()))
    handle({ type: 'campaign-forfeit', requestId: 'forfeit-a', battleSeed: a.init.battleSeed })
    const b = prepared(handle(prepare(input('quickattack'), 'prepare-b')))
    expect(a.init.battleSeed).not.toBe(b.init.battleSeed)
    handle({ type: 'campaign-forfeit', requestId: 'forfeit-b', battleSeed: b.init.battleSeed })
    expect(handle({ type: 'campaign-finish', requestId: 'old-seed', input: { definition, state: b.state, battleSeed: a.init.battleSeed } })).toEqual(error('old-seed'))
    expect(handle({ type: 'campaign-finish', requestId: 'old-state', input: { definition, state: a.state, battleSeed: b.init.battleSeed } })).toEqual(error('old-state'))
    expect(handle({ type: 'campaign-finish', requestId: 'valid', input: { definition, state: b.state, battleSeed: b.init.battleSeed } }))
      .toMatchObject({ type: 'campaign-finished', requestId: 'valid', state: { phase: 'lost' } })
  })

  it('rechaza decisiones y rendiciones de otra preparación sin tocar el combate activo', () => {
    const handle = createWorkerHandler()
    const start = prepared(handle(prepare()))
    expect(handle({ type: 'campaign-choose', requestId: 'wrong-choice', battleSeed: 'other', choice: { type: 'move', slot: 1 } })).toEqual(error('wrong-choice'))
    expect(handle({ type: 'campaign-forfeit', requestId: 'wrong-forfeit', battleSeed: 'other' })).toEqual(error('wrong-forfeit'))
    expect(handle({ type: 'campaign-choose', requestId: 'valid', battleSeed: start.init.battleSeed, choice: { type: 'move', slot: 1 } }))
      .toMatchObject({ type: 'campaign-update', update: { view: { turn: 2 } } })
  })

  it('no permite cerrar antes de acabar ni aplicar un resultado que no conserva el motor', () => {
    const handle = createWorkerHandler()
    const start = prepared(handle(prepare()))
    const command: CampaignWorkerCommand = { type: 'campaign-finish', requestId: 'early', input: { definition, state: start.state, battleSeed: start.init.battleSeed } }
    expect(handle(command)).toEqual(error('early'))
    expect(createWorkerHandler()(command)).toEqual(error('early'))
    expect(handle({ type: 'campaign-forfeit', requestId: 'quit', battleSeed: start.init.battleSeed }))
      .toMatchObject({ type: 'campaign-update', update: { ended: { result: 'loss', reason: 'forfeit' } } })
    expect(handle(command)).toMatchObject({ type: 'campaign-finished', state: { phase: 'lost' } })
  })

  it('valida la preparación y una decisión inválida sin perder el combate que está en curso', () => {
    const handle = createWorkerHandler()
    const start = prepared(handle(prepare()))
    expect(handle(prepare(input('leafblade'), 'illegal-move'))).toEqual(error('illegal-move'))
    expect(handle({ type: 'campaign-choose', requestId: 'illegal-slot', battleSeed: start.init.battleSeed, choice: { type: 'move', slot: 9 } })).toEqual(error('illegal-slot'))
    expect(handle({ type: 'campaign-choose', requestId: 'valid', battleSeed: start.init.battleSeed, choice: { type: 'move', slot: 1 } }))
      .toMatchObject({ type: 'campaign-update', update: { view: { turn: 2 } } })
  })

  it('aísla los protocolos y conserva exactamente los mensajes del reto diario Gen 5', () => {
    const handle = createWorkerHandler()
    const start = prepared(handle(prepare()))
    expect(handle({ type: 'forfeit' })).toEqual({ type: 'error', message: es.errors.engine })
    const init = { battleSeed: 'daily-unchanged', player: harmlessTeam(), rival: harmlessTeam(), ai: 'trivial' as const, maxTurns: 300 }
    const direct = createBattleEngine(init)
    expect(handle({ type: 'init', init })).toEqual({ type: 'update', ...direct.start() })
    expect(handle({ type: 'campaign-forfeit', requestId: 'stale', battleSeed: start.init.battleSeed })).toEqual(error('stale'))
    expect(handle({ type: 'choose', choice: { type: 'move', slot: 1 } })).toEqual({ type: 'update', ...direct.choose({ type: 'move', slot: 1 }) })
    expect(handle({ type: 'forfeit' })).toEqual({ type: 'update', ...direct.forfeit() })
    const seen: unknown[] = []
    const worker: WorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate() {}, postMessage(command) { seen.push(command) } }
    const client = createWorkerClient(() => worker)
    client.init(init)
    client.choose({ type: 'move', slot: 1 })
    client.forfeit()
    expect(seen).toEqual([{ type: 'init', init }, { type: 'choose', choice: { type: 'move', slot: 1 } }, { type: 'forfeit' }])
  })

  it('conecta los nuevos comandos también en la entrada real battle.worker.ts', async () => {
    const scope: { onmessage: ((event: MessageEvent<BattleWorkerCommand>) => void) | null; postMessage: (message: BattleWorkerMessage) => void } =
      { onmessage: null, postMessage: vi.fn() }
    vi.stubGlobal('self', scope)
    try {
      await import('./battle.worker')
      scope.onmessage!({ data: structuredClone(prepare()) } as MessageEvent<BattleWorkerCommand>)
      expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'campaign-prepared', requestId: 'prepare', init: expect.objectContaining({ generation: 3 }) }))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('envía comandos tipados, entrega errores del transporte y cancela suscripciones', () => {
    const worker = transport()
    worker.postMessage = vi.fn()
    const client = createCampaignWorkerClient(() => worker)
    const listener = vi.fn()
    const unsubscribe = client.subscribe(listener)
    client.prepare('p', input())
    client.choose('c', 'seed', { type: 'move', slot: 1 })
    client.forfeit('q', 'seed')
    client.finish('f', { definition, state: input().state, battleSeed: 'seed' })
    expect(worker.postMessage).toHaveBeenNthCalledWith(1, prepare(input(), 'p'))
    expect(worker.postMessage).toHaveBeenNthCalledWith(2, { type: 'campaign-choose', requestId: 'c', battleSeed: 'seed', choice: { type: 'move', slot: 1 } })
    expect(worker.postMessage).toHaveBeenNthCalledWith(3, { type: 'campaign-forfeit', requestId: 'q', battleSeed: 'seed' })
    expect(worker.postMessage).toHaveBeenNthCalledWith(4, { type: 'campaign-finish', requestId: 'f', input: { definition, state: input().state, battleSeed: 'seed' } })
    worker.onerror!(new Event('error'))
    worker.onmessageerror!({} as MessageEvent)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalledWith({ type: 'campaign-error', requestId: null, message: es.errors.worker })
    unsubscribe()
    worker.onerror!(new Event('error'))
    expect(listener).toHaveBeenCalledTimes(2)
    client.subscribe(listener)
    client.terminate()
    worker.onerror!(new Event('error'))
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
