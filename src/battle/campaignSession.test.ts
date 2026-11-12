import { describe, expect, it } from 'vitest'
import { createCampaignWorkerClient, type CampaignWorkerLike } from './client'
import { createWorkerHandler, type CampaignClientMessage } from './messages'
import { LocalCampaignSession } from './campaignSession'
import { LocalCampaignStore, CAMPAIGN_STORAGE_KEY } from '../storage/campaignStore'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { campaignInput } from '../test-utils/campaign'
import { firstEnabled } from '../test-utils/harness'

function mount(storage: Storage | null = new MemoryStorage(), defer = false) {
  const handle = createWorkerHandler()
  const queue: CampaignClientMessage[] = []
  const messages: CampaignClientMessage[] = []
  const worker: CampaignWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate() {},
    postMessage(command) {
      const message = structuredClone(handle(structuredClone(command)))
      if (defer) queue.push(message)
      else this.onmessage?.({ data: message } as MessageEvent)
    } }
  const store = new LocalCampaignStore(storage)
  const session = new LocalCampaignSession(createCampaignWorkerClient(() => worker), store)
  session.subscribe(message => messages.push(message))
  return { session, store, messages, queue, worker, deliver(index = 0) {
    worker.onmessage?.({ data: queue.splice(index, 1)[0] } as MessageEvent)
  } }
}
const latestUpdate = (m: ReturnType<typeof mount>) => {
  const message = m.messages.at(-1)!
  if (message.type !== 'campaign-prepared' && message.type !== 'campaign-resumed' && message.type !== 'campaign-update') throw new Error('Sin update')
  return message.update
}

describe('sesión local de campaña', () => {
  it('reanuda a mitad de combate con la misma identidad, vista, petición y continuación', () => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    const live = mount(storage)
    live.session.prepare(input)
    const initial = live.session.snapshot()!
    for (let step = 0; step < 3; step++) live.session.choose(firstEnabled(latestUpdate(live).request!))
    const before = live.session.snapshot()!
    const copied = new MemoryStorage()
    copied.setItem(CAMPAIGN_STORAGE_KEY, storage.getItem(CAMPAIGN_STORAGE_KEY)!)
    const resumed = mount(copied)
    expect(() => resumed.session.choose({ type: 'move', slot: 1 })).toThrow(/lista/)
    resumed.session.resume(input.definition)
    expect(latestUpdate(resumed)).toEqual(latestUpdate(live))
    expect(resumed.session.snapshot()!.state).toEqual(before.state)
    expect(resumed.session.snapshot()!.battle!.init).toEqual(initial.battle!.init)
    expect(resumed.session.snapshot()!.battle!.decisions).toEqual(before.battle!.decisions)
    const choice = firstEnabled(latestUpdate(live).request!)
    live.session.choose(choice)
    resumed.session.choose(choice)
    expect(latestUpdate(resumed)).toEqual(latestUpdate(live))
    expect(JSON.stringify(before)).not.toContain('"definition"')
  })

  it('conserva las identidades repetidas y las bajas con otro inicial al reanudar un cambio forzado', () => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    input.state.members = ['fish-a', 'fish-b'].map(id => ({ id, species: 'magikarp', level: 15, history: [], fainted: false, victories: 0 }))
    input.selected = ['fish-a', 'fish-b']
    input.preparation = { unlockedMoves: [], movesByMember: { 'fish-a': ['splash'], 'fish-b': ['splash'] }, leadId: 'fish-b' }
    const live = mount(storage)
    live.session.prepare(input)
    for (let count = 0; count < 100 && !latestUpdate(live).request?.forceSwitch; count++) {
      live.session.choose(firstEnabled(latestUpdate(live).request!))
    }
    expect(latestUpdate(live).request?.forceSwitch).toEqual([true])
    const resumed = mount(storage)
    resumed.session.resume(input.definition)
    expect(latestUpdate(resumed)).toEqual(latestUpdate(live))
    expect(latestUpdate(resumed).view.player.team.map(mon => [mon.teamIndex, mon.fainted])).toEqual([[1, true], [0, false]])
    resumed.session.choose({ type: 'switch', slot: 2 })
    expect(latestUpdate(resumed).request?.side.pokemon[0].ident).toBe('p1: magikarp__0')
    resumed.session.forfeit()
    resumed.session.finish(input.definition)
    expect(resumed.session.snapshot()!.state.members.map(member => [member.id, member.fainted])).toEqual([['fish-a', false], ['fish-b', true]])
  })

  it('reconstruye los mismos IV mixtos de Poder Oculto y acepta las claves JSON en otro orden', () => {
    const storage = new MemoryStorage()
    const input = campaignInput('hiddenpower')
    input.preparation.unlockedMoves = ['hiddenpower']
    const live = mount(storage)
    live.session.prepare(input)
    const expected = latestUpdate(live)
    const saved = live.session.snapshot()!
    const init = saved.battle!.init!
    expect(new Set(Object.values(init.player[0].ivs))).toEqual(new Set([19, 20]))
    saved.battle!.init = Object.fromEntries(Object.entries(init).reverse()) as typeof init
    storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(saved))
    const resumed = mount(storage)
    resumed.session.resume(input.definition)
    expect(latestUpdate(resumed)).toEqual(expected)
    expect(resumed.session.snapshot()!.battle!.init!.battleSeed).toBe(init.battleSeed)
  })

  it('persiste la preparación antes de su confirmación y la recupera tras recargar', () => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    const delayed = mount(storage, true)
    delayed.session.prepare(input)
    expect(delayed.session.snapshot()!.battle).toMatchObject({ init: null, decisions: [], source: { preparation: input.preparation } })
    const expected = delayed.queue[0]
    delayed.session.stop()
    const resumed = mount(storage)
    resumed.session.resume(input.definition)
    const actual = resumed.messages.at(-1)!
    expect(actual.type).toBe('campaign-prepared')
    if (actual.type !== 'campaign-prepared' || expected.type !== 'campaign-prepared') throw new Error('Sin preparación')
    expect(actual.init).toEqual(expected.init)
    expect(actual.state).toEqual(expected.state)
  })

  it('guarda antes de enviar la decisión y no la duplica al perderse la confirmación', () => {
    const storage = new MemoryStorage()
    const delayed = mount(storage, true)
    const input = campaignInput()
    delayed.session.prepare(input)
    delayed.deliver()
    delayed.session.choose({ type: 'move', slot: 1 })
    expect(delayed.session.snapshot()!.battle!.decisions).toEqual([{ type: 'move', slot: 1 }])
    const expected = delayed.queue[0]
    delayed.session.stop()
    const resumed = mount(storage)
    resumed.session.resume(input.definition)
    expect(expected.type).toBe('campaign-update')
    if (expected.type !== 'campaign-update') throw new Error('Sin decisión')
    expect(latestUpdate(resumed)).toEqual(expected.update)
    expect(resumed.session.snapshot()!.battle!.decisions).toHaveLength(1)
    expect(resumed.session.snapshot()!.battle!.checkpoint!.decisions).toBe(1)
  })

  // UT-201 (Jose, 12/11/2026: «La campaña no está lista para otra decisión» y la pantalla se quedaba pillada).
  it('una decisión durante el arranque espera a que esté listo; otra con una decisión en curso se descarta; reanudar dos veces no falla', () => {
    const delayed = mount(new MemoryStorage(), true)
    const input = campaignInput()
    delayed.session.prepare(input)
    expect(() => delayed.session.resume(input.definition)).not.toThrow()
    expect(() => delayed.session.choose({ type: 'move', slot: 1 })).not.toThrow()
    expect(delayed.session.snapshot()!.battle!.decisions).toEqual([])
    delayed.deliver()
    expect(delayed.session.snapshot()!.battle!.decisions).toEqual([{ type: 'move', slot: 1 }])
    expect(() => delayed.session.choose({ type: 'move', slot: 2 })).not.toThrow()
    expect(delayed.session.snapshot()!.battle!.decisions).toEqual([{ type: 'move', slot: 1 }])
  })

  it('reanuda tras rendirse y cierra una sola vez, incluso si se pierde la confirmación del cierre', () => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    const delayed = mount(storage, true)
    delayed.session.prepare(input)
    delayed.deliver()
    delayed.session.forfeit()
    delayed.deliver()
    expect(() => delayed.session.choose({ type: 'move', slot: 1 })).toThrow(/terminado/)
    delayed.session.finish(input.definition)
    const expected = delayed.queue[0]
    delayed.session.stop()
    const resumed = mount(storage)
    resumed.session.resume(input.definition)
    expect(latestUpdate(resumed).ended?.reason).toBe('forfeit')
    resumed.session.finish(input.definition)
    const actual = resumed.messages.at(-1)!
    if (expected.type !== 'campaign-finished' || actual.type !== 'campaign-finished') throw new Error('Sin cierre')
    expect(actual.state).toEqual(expected.state)
    expect(resumed.session.snapshot()).toMatchObject({ state: { phase: 'lost' }, battle: null })
    expect(() => resumed.session.finish(input.definition)).toThrow()
    expect(() => mount(storage).session.resume(input.definition)).toThrow(/guardado/)
  })

  it('ignora una preparación y un resultado atrasados sin sustituir la preparación vigente', () => {
    const storage = new MemoryStorage()
    const delayed = mount(storage, true)
    const a = campaignInput(), b = campaignInput('quickattack')
    delayed.session.prepare(a)
    delayed.session.prepare(b)
    delayed.deliver(0)
    expect(delayed.session.snapshot()!.battle!.init).toBeNull()
    delayed.deliver(0)
    const seedB = delayed.session.snapshot()!.battle!.init!.battleSeed
    delayed.session.forfeit()
    delayed.deliver()
    delayed.session.finish(b.definition)
    delayed.session.prepare(a)
    delayed.deliver(0)
    expect(delayed.session.snapshot()!.state.phase).toBe('prepare')
    delayed.deliver(0)
    expect(delayed.session.snapshot()!.battle!.init!.battleSeed).not.toBe(seedB)
    expect(delayed.session.snapshot()!.state.phase).toBe('battle')
  })

  it('revierte una decisión rechazada y permite seguir con otra válida', () => {
    const m = mount()
    m.session.prepare(campaignInput())
    m.session.choose({ type: 'move', slot: 9 })
    expect(m.messages.at(-1)?.type).toBe('campaign-error')
    expect(m.session.snapshot()!.battle!.decisions).toEqual([])
    m.session.choose({ type: 'move', slot: 1 })
    expect(latestUpdate(m).view.turn).toBe(2)
  })

  it.each(['checkpoint', 'init', 'state', 'decisions', 'definition'] as const)('rechaza un guardado divergente (%s) sin borrarlo', field => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    const original = mount(storage)
    original.session.prepare(input)
    original.session.choose({ type: 'move', slot: 1 })
    const saved = original.session.snapshot()!
    if (field === 'checkpoint') saved.battle!.checkpoint!.update.view.player.team[0].hp = 1
    if (field === 'init') saved.battle!.init!.rival[0].level = 1
    if (field === 'state') saved.state.members = saved.state.members.map((member, index) => index ? member : { ...member, victories: 20 })
    if (field === 'decisions') saved.battle!.decisions.push({ type: 'move', slot: 9 })
    if (field === 'definition') input.definition = { ...input.definition, encounters: input.definition.encounters.map((e, index) => index ? e : { ...e, team: e.team.map((mon, slot) => slot ? mon : { ...mon, level: 1 }) }) }
    storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(saved))
    const raw = storage.getItem(CAMPAIGN_STORAGE_KEY)
    const resumed = mount(storage)
    resumed.session.resume(input.definition)
    expect(resumed.messages.at(-1)?.type).toBe('campaign-error')
    expect(storage.getItem(CAMPAIGN_STORAGE_KEY)).toBe(raw)
    expect(() => resumed.session.choose({ type: 'move', slot: 1 })).toThrow()
  })

  it('conserva la decisión pendiente al fallar el transporte y permite reconstruirla', () => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    const m = mount(storage, true)
    m.session.prepare(input)
    m.deliver()
    m.session.choose({ type: 'move', slot: 1 })
    m.worker.onerror!(new Event('error'))
    expect(m.messages.at(-1)).toMatchObject({ type: 'campaign-error', requestId: null })
    const resumed = mount(storage)
    resumed.session.resume(input.definition)
    expect(latestUpdate(resumed).view.turn).toBe(2)
  })

  it('impide decidir desde un motor atrasado si otra sesión ya ha guardado una revisión nueva', () => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    const a = mount(storage)
    a.session.prepare(input)
    const b = mount(storage)
    b.session.resume(input.definition)
    const raw = storage.getItem(CAMPAIGN_STORAGE_KEY)
    expect(() => a.session.choose({ type: 'move', slot: 1 })).toThrow(/cambiado/)
    expect(storage.getItem(CAMPAIGN_STORAGE_KEY)).toBe(raw)
    b.session.choose({ type: 'move', slot: 1 })
    expect(latestUpdate(b).view.turn).toBe(2)
  })

  it('no acepta una respuesta si otra sesión ha cambiado la revisión persistida', () => {
    const storage = new MemoryStorage()
    const input = campaignInput()
    const m = mount(storage, true)
    m.session.prepare(input)
    const other = mount(storage)
    other.session.prepare(campaignInput('quickattack'))
    const raw = storage.getItem(CAMPAIGN_STORAGE_KEY)
    m.deliver()
    expect(m.messages.at(-1)?.type).toBe('campaign-error')
    expect(storage.getItem(CAMPAIGN_STORAGE_KEY)).toBe(raw)
  })
})
