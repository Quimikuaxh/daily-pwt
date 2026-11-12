import { describe, expect, it, vi } from 'vitest'
import { AccountCampaign, campaignAccountKey } from './campaign'
import { Account } from './account'
import { LocalStorageStore } from '../storage/localStorageStore'
import { fakeApi, fakeAuth, fakeCloud, networkError, serverError } from '../test-utils/cloud'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { campaignInput } from '../test-utils/campaign'
import { createCampaign, openDraft, chooseRecruit } from '../core/nuzlocke/campaign'
import type { CampaignRecord } from '../storage/campaignStore'
import type { CampaignOperation, CampaignReceipt } from './api'
import { createCampaignWorkerClient, type CampaignWorkerLike } from '../battle/client'
import { createWorkerHandler } from '../battle/messages'
import type { CampaignClientMessage } from '../battle/client'
import { esCampaign } from '../i18n/esCampaign'

const record = (revision = 1): CampaignRecord => ({ version: 1, revision, state: createCampaign('cloud'), battle: null })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function setup(api = fakeApi(), storage: Storage | null = new MemoryStorage()) {
  const campaign = new AccountCampaign(storage)
  campaign.setAccount(api, 'g1')
  await campaign.load()
  return { api, campaign, storage: storage as MemoryStorage }
}

describe('guardado de campaña por cuenta, D4(b)', () => {
  it('no consulta Supabase antes de abrir el modo y nunca importa el prototipo local', async () => {
    const api = fakeApi()
    const campaign = new AccountCampaign(new MemoryStorage())
    await expect(campaign.load()).rejects.toThrow(esCampaign.closed)
    campaign.setAccount(api, 'g1')
    expect(api.getCampaign).not.toHaveBeenCalled()
    await campaign.load()
    expect(campaign.getState()).toMatchObject({ status: 'ready', record: null })
    expect(api.saveCampaign).not.toHaveBeenCalled()
  })

  it('guarda oferta y elección por revisión, conserva la alineación en preparación y envía snapshots independientes', async () => {
    const { api, campaign } = await setup()
    const first = record()
    // La oferta se mantiene como dato persistido; el sorteo sigue perteneciendo al núcleo.
    const definition = campaignInput().definition
    const offered = openDraft(definition, first.state)
    const savedOffer = await campaign.write(offered, null, 0)
    const chosen = chooseRecruit(definition, offered, offered.offer[0])
    await campaign.write(chosen, null, savedOffer.revision)
    expect(api.saveCampaign.mock.calls.map(([op]) => op.expectedRevision)).toEqual([0, 1])
    expect(api.saveCampaign.mock.calls[0][0].record.state).toEqual(offered)
    expect(api.saveCampaign.mock.calls[1][0].record.state).toEqual(chosen)
    chosen.seed = 'mutated'
    expect(campaign.read()?.state.seed).not.toBe('mutated')
  })

  it('conserva UUID y contenido si la respuesta se pierde, incluso después de recargar el navegador', async () => {
    const api = fakeApi()
    api.saveCampaign.mockRejectedValueOnce(networkError())
    const { campaign, storage } = await setup(api)
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow(esCampaign.offline)
    const pending = structuredClone(api.saveCampaign.mock.calls[0][0])
    expect(campaign.getState()).toMatchObject({ status: 'offline', record: pending.record })
    expect(JSON.parse(storage.getItem(campaignAccountKey('g1'))!).pending).toEqual(pending)
    api.getCampaign.mockResolvedValue(pending.record)
    const reloaded = new AccountCampaign(storage)
    reloaded.setAccount(api, 'g1')
    await reloaded.load()
    expect(api.saveCampaign.mock.calls[1][0]).toEqual(pending)
    expect(reloaded.getState()).toMatchObject({ status: 'ready', record: pending.record })
  })

  it('un fallo de red bloquea nuevas intenciones hasta reintentar la pendiente', async () => {
    const { api, campaign } = await setup()
    api.saveCampaign.mockRejectedValueOnce(networkError())
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow()
    await expect(campaign.write(createCampaign('new'), null, 1)).rejects.toThrow(esCampaign.offline)
    await campaign.retry()
    expect(api.saveCampaign.mock.calls[1][0]).toEqual(api.saveCampaign.mock.calls[0][0])
    expect(campaign.getState().status).toBe('ready')
  })

  it('un conflicto detiene escrituras y reintentos y conserva los cambios hasta confirmar reload', async () => {
    const { api, campaign, storage } = await setup(fakeApi({ getCampaign: async () => record(4) }))
    api.saveCampaign.mockRejectedValueOnce(serverError('campaign_revision_conflict'))
    const local = createCampaign('local-pending')
    await expect(campaign.write(local, null, 4)).rejects.toThrow(esCampaign.conflict)
    expect(campaign.read()?.state).toEqual(local)
    const bytes = storage.getItem(campaignAccountKey('g1'))
    await expect(campaign.write(local, null, 5)).rejects.toThrow(esCampaign.conflict)
    await campaign.retry()
    await campaign.load()
    expect(api.saveCampaign).toHaveBeenCalledTimes(1)
    expect(storage.getItem(campaignAccountKey('g1'))).toBe(bytes)
    api.getCampaign.mockResolvedValue(record(6))
    await campaign.reload()
    expect(campaign.getState()).toMatchObject({ status: 'ready', record: record(6) })
    expect(JSON.parse(storage.getItem(campaignAccountKey('g1'))!).pending).toBeNull()
    expect(esCampaign.reload).toBe('Recargar campaña')
  })

  it('recargar la página tampoco descarta el conflicto ni reenvía su operación', async () => {
    const { api, campaign, storage } = await setup()
    api.saveCampaign.mockRejectedValueOnce(serverError('campaign_revision_conflict'))
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow()
    const next = new AccountCampaign(storage)
    next.setAccount(api, 'g1')
    await next.load()
    expect(next.getState()).toMatchObject({ status: 'conflict', record: campaign.read() })
    expect(api.saveCampaign).toHaveBeenCalledTimes(1)
    expect(api.getCampaign).toHaveBeenCalledTimes(1)
  })

  it.each([networkError(), serverError('invalid_campaign')])('una recarga fallida conserva intención y bytes (%s)', async error => {
    const { api, campaign, storage } = await setup()
    api.saveCampaign.mockRejectedValueOnce(serverError('campaign_revision_conflict'))
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow()
    const before = campaign.read(), bytes = storage.getItem(campaignAccountKey('g1'))
    api.getCampaign.mockRejectedValueOnce(error)
    await campaign.reload()
    expect(campaign.getState().status).toBe('conflict')
    expect(campaign.read()).toEqual(before)
    expect(storage.getItem(campaignAccountKey('g1'))).toBe(bytes)
  })

  it('un recibo de una revisión antigua no sustituye automáticamente el estado local', async () => {
    const { api, campaign, storage } = await setup()
    api.saveCampaign.mockRejectedValueOnce(networkError())
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow()
    api.getCampaign.mockResolvedValue(record(8))
    const next = new AccountCampaign(storage)
    next.setAccount(api, 'g1')
    await next.load()
    expect(next.getState()).toMatchObject({ status: 'conflict', record: record() })
    await next.reload()
    expect(next.read()).toEqual(record(8))
  })

  it.each(['{"version":99}', '{bad'])('conserva cachés incompatibles y bloquea escrituras (%s)', async bytes => {
    const storage = new MemoryStorage()
    storage.setItem(campaignAccountKey('g1'), bytes)
    const { campaign, api } = await setup(fakeApi(), storage)
    expect(campaign.getState()).toMatchObject({ status: 'error', message: esCampaign.invalid })
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow(esCampaign.invalid)
    expect(storage.getItem(campaignAccountKey('g1'))).toBe(bytes)
    expect(api.saveCampaign).not.toHaveBeenCalled()
  })

  it('no sobrescribe un formato remoto desconocido ni acepta recibos ajenos', async () => {
    const bad = await setup(fakeApi({ getCampaign: async () => ({ ...record(), version: 2 }) }))
    expect(bad.campaign.getState().status).toBe('error')
    const { api, campaign } = await setup()
    api.saveCampaign.mockResolvedValueOnce({ revision: 1, operationId: 'other' })
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow(esCampaign.invalid)
    expect(campaign.getState().status).toBe('error')
  })

  it('rechaza revisiones remotas que no se pueden representar exactamente en JavaScript', async () => {
    const { campaign } = await setup(fakeApi({ getCampaign: async () => record(Number.MAX_SAFE_INTEGER + 1) }))
    expect(campaign.getState()).toMatchObject({ status: 'error', message: esCampaign.invalid })
  })

  it('solo permite un guardado en vuelo y descarta respuestas tras cambiar de cuenta', async () => {
    const wait = deferred<CampaignReceipt>()
    const { api, campaign } = await setup()
    api.saveCampaign.mockImplementationOnce(() => wait.promise)
    const writing = campaign.write(record().state, null, 0)
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow(esCampaign.busy)
    const op = api.saveCampaign.mock.calls[0][0]
    campaign.setAccount(api, 'g2')
    wait.resolve({ operationId: op.operationId, revision: 1 })
    await expect(writing).rejects.toThrow(esCampaign.closed)
    expect(campaign.getState()).toMatchObject({ status: 'closed', record: null })
    await campaign.load()
    expect(campaign.read()).toBeNull()
  })

  it('ignora una lectura tardía al cerrar sesión', async () => {
    const wait = deferred<unknown>()
    const api = fakeApi({ getCampaign: () => wait.promise })
    const campaign = new AccountCampaign(new MemoryStorage())
    campaign.setAccount(api, 'g1')
    const loading = campaign.load()
    campaign.setAccount(null, null)
    wait.resolve(record())
    await expect(loading).rejects.toThrow(esCampaign.closed)
    expect(campaign.read()).toBeNull()
  })

  it('sin localStorage guarda en la cuenta y expone persistent=false', async () => {
    const { campaign } = await setup(fakeApi(), null)
    await campaign.write(record().state, null, 0)
    expect(campaign.getState()).toMatchObject({ status: 'ready', persistent: false, record: record() })
  })

  it('cerrar sesión limpia inmediatamente campaña y motor, aunque Auth siga pendiente', async () => {
    const api = fakeApi({ getCampaign: async () => record() })
    const wait = deferred<void>()
    const google = { userId: 'g1', anonymous: false }
    const cloud = fakeCloud(google, api, fakeAuth(google, { signOut: () => wait.promise }))
    const storage = new MemoryStorage()
    const account = new Account(Promise.resolve(cloud), storage, new LocalStorageStore(storage))
    await account.start()
    await account.campaign.load()
    const worker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() }
    const session = account.campaign.createSession(createCampaignWorkerClient(() => worker))
    const signingOut = account.signOut()
    expect(account.campaign.read()).toBeNull()
    expect(account.campaign.getState().status).toBe('closed')
    expect(worker.terminate).toHaveBeenCalled()
    expect(session.snapshot()).toBeNull()
    // Un resumen del diario que termine durante el cierre no debe reabrir la campaña.
    await account.refreshSummary()
    await expect(account.campaign.load()).rejects.toThrow(esCampaign.closed)
    wait.resolve()
    await signingOut
    await expect(account.campaign.load()).rejects.toThrow(esCampaign.closed)
    expect(storage.getItem(campaignAccountKey('g1'))).not.toBeNull()
  })

  it('conecta los puntos reales de D1 y espera al servidor antes del worker y antes de publicar su respuesta', async () => {
    const { api, campaign } = await setup()
    const handle = createWorkerHandler()
    const seen: CampaignClientMessage[] = []
    const sent: unknown[] = []
    const worker: CampaignWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate: vi.fn(),
      postMessage(command) {
        sent.push(command)
        this.onmessage?.({ data: handle(command) } as MessageEvent)
      } }
    const session = campaign.createSession(createCampaignWorkerClient(() => worker))
    session.subscribe(message => seen.push(message))
    const wait = deferred<CampaignReceipt>()
    api.saveCampaign.mockImplementationOnce(() => wait.promise)
    const input = campaignInput()
    const preparing = session.prepare(input)
    expect(sent).toHaveLength(0)
    const pending = api.saveCampaign.mock.calls[0][0]
    expect(pending.record.battle).toMatchObject({ source: { selected: input.selected }, init: null })
    wait.resolve({ operationId: pending.operationId, revision: 1 })
    await preparing
    await vi.waitFor(() => expect(seen.at(-1)?.type).toBe('campaign-prepared'))
    expect(api.saveCampaign.mock.calls[1][0].record.battle?.init).not.toBeNull()
    await session.choose({ type: 'move', slot: 1 })
    await vi.waitFor(() => expect(seen.at(-1)?.type).toBe('campaign-update'))
    expect(api.saveCampaign.mock.calls[2][0].record.battle?.decisions).toEqual([{ type: 'move', slot: 1 }])
    expect(api.saveCampaign.mock.calls[3][0].record.battle?.checkpoint?.decisions).toBe(1)
    await session.forfeit()
    await vi.waitFor(() => expect(seen.filter(m => m.type === 'campaign-update')).toHaveLength(2))
    session.finish(input.definition)
    await vi.waitFor(() => expect(seen.at(-1)?.type).toBe('campaign-finished'))
    expect(campaign.read()?.battle).toBeNull()
    expect(api.saveCampaign.mock.calls.at(-1)![0].record.state.phase).toBe('lost')
    expect(api.startOfficial).not.toHaveBeenCalled()
  })

  it('un conflicto durante la preparación no envía nada al worker y lo termina', async () => {
    const { api, campaign } = await setup()
    api.saveCampaign.mockRejectedValueOnce(serverError('campaign_revision_conflict'))
    const worker = { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() }
    const session = campaign.createSession(createCampaignWorkerClient(() => worker))
    await expect(session.prepare(campaignInput())).rejects.toThrow(esCampaign.conflict)
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(worker.terminate).toHaveBeenCalled()
    expect(campaign.read()?.battle?.init).toBeNull()
  })

  it('dos pestañas con la misma revisión conservan sus estados y solo la primera escribe', async () => {
    let remote = record()
    const api = fakeApi({ getCampaign: async () => structuredClone(remote), saveCampaign: async op => {
      if (op.expectedRevision !== remote.revision) throw serverError('campaign_revision_conflict')
      remote = structuredClone(op.record)
      return { operationId: op.operationId, revision: remote.revision }
    } })
    const storage = new MemoryStorage()
    const a = (await setup(api, storage)).campaign
    const b = (await setup(api, storage)).campaign
    await a.write(createCampaign('first-tab'), null, 1)
    await expect(b.write(createCampaign('second-tab-pending'), null, 1)).rejects.toThrow(esCampaign.conflict)
    expect(remote.state.seed).toBe('first-tab')
    expect(a.read()?.state.seed).toBe('first-tab')
    expect(b.read()?.state.seed).toBe('second-tab-pending')
    await b.reload()
    expect(b.read()).toEqual(remote)
  })

  it('reanuda en otro dispositivo el combate confirmado y reproduce su checkpoint', async () => {
    let remote: CampaignRecord | null = null
    const api = fakeApi({ getCampaign: async () => structuredClone(remote), saveCampaign: async op => {
      remote = structuredClone(op.record)
      return { operationId: op.operationId, revision: remote.revision }
    } })
    function mount(campaign: AccountCampaign) {
      const handle = createWorkerHandler()
      const messages: CampaignClientMessage[] = []
      const worker: CampaignWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate() {},
        postMessage(command) { this.onmessage?.({ data: handle(command) } as MessageEvent) } }
      const session = campaign.createSession(createCampaignWorkerClient(() => worker))
      session.subscribe(m => messages.push(m))
      return { session, messages }
    }
    const first = mount((await setup(api)).campaign)
    const input = campaignInput()
    await first.session.prepare(input)
    await vi.waitFor(() => expect(first.messages.at(-1)?.type).toBe('campaign-prepared'))
    await first.session.choose({ type: 'move', slot: 1 })
    await vi.waitFor(() => expect(first.messages.at(-1)?.type).toBe('campaign-update'))
    const checkpoint = first.session.snapshot()!.battle!.checkpoint
    first.session.stop()
    const other = mount((await setup(api)).campaign)
    other.session.resume(input.definition)
    await vi.waitFor(() => expect(other.messages.at(-1)?.type).toBe('campaign-resumed'))
    expect(other.session.snapshot()!.battle!.checkpoint).toEqual(checkpoint)
    expect(other.session.snapshot()!.battle!.decisions).toHaveLength(1)
  })

  it('no publica una respuesta del worker hasta confirmar su checkpoint remoto', async () => {
    const { api, campaign } = await setup()
    const wait = deferred<CampaignReceipt>()
    api.saveCampaign.mockImplementationOnce(async op => ({ operationId: op.operationId, revision: op.record.revision }))
      .mockImplementationOnce(() => wait.promise)
    const handle = createWorkerHandler()
    const worker: CampaignWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate() {},
      postMessage(command) { this.onmessage?.({ data: handle(command) } as MessageEvent) } }
    const messages: CampaignClientMessage[] = []
    const session = campaign.createSession(createCampaignWorkerClient(() => worker))
    session.subscribe(m => messages.push(m))
    await session.prepare(campaignInput())
    expect(messages).toHaveLength(0)
    // Cambio de requisito (Jose, 12/11/2026): una decisión durante el arranque ya no falla; espera a que la sesión esté lista.
    expect(() => session.choose({ type: 'move', slot: 1 })).not.toThrow()
    const op = api.saveCampaign.mock.calls[1][0]
    wait.resolve({ operationId: op.operationId, revision: op.record.revision })
    await vi.waitFor(() => expect(messages.some((message) => message.type === 'campaign-prepared')).toBe(true))
  })

  it('no reenvía una intención pendiente de A al abrir B; la recupera solo al volver a A', async () => {
    const { api, campaign, storage } = await setup()
    api.saveCampaign.mockRejectedValueOnce(networkError())
    await expect(campaign.write(createCampaign('private-A'), null, 0)).rejects.toThrow()
    const pending = api.saveCampaign.mock.calls[0][0]
    campaign.setAccount(api, 'g2')
    await campaign.load()
    expect(campaign.read()).toBeNull()
    expect(api.saveCampaign).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.getItem(campaignAccountKey('g1'))!).pending).toEqual(pending)
    campaign.setAccount(api, 'g1')
    api.getCampaign.mockResolvedValue(pending.record)
    await campaign.load()
    expect(api.saveCampaign.mock.calls[1][0]).toEqual(pending)
  })

  it('cuota agotada conserva la intención en memoria y la reintenta con el mismo UUID', async () => {
    const storage = new MemoryStorage()
    const { campaign, api } = await setup(fakeApi(), storage)
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    api.saveCampaign.mockRejectedValueOnce(networkError())
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow()
    expect(campaign.getState().persistent).toBe(false)
    // Reabrir el modo no debe sustituir la intención en memoria por la caché anterior a agotar la cuota.
    api.getCampaign.mockResolvedValue(record())
    await campaign.load()
    await campaign.retry()
    expect(api.saveCampaign.mock.calls[1][0]).toEqual(api.saveCampaign.mock.calls[0][0])
    expect(campaign.read()).toEqual(record())
  })

  it('no elimina una campaña confirmada si una lectura posterior devuelve una revisión ausente o anterior', async () => {
    const storage = new MemoryStorage()
    const api = fakeApi({ getCampaign: async () => record(4) })
    const initial = (await setup(api, storage)).campaign
    expect(initial.read()).toEqual(record(4))
    api.getCampaign.mockResolvedValue(null)
    const { campaign } = await setup(api, storage)
    expect(campaign.getState()).toMatchObject({ status: 'error', record: record(4) })
  })

  it('si no se pudo leer la caché, no sobrescribe sus bytes aunque las escrituras estén permitidas', async () => {
    const storage = new MemoryStorage()
    storage.setItem(campaignAccountKey('g1'), 'unreadable')
    const read = vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const { campaign } = await setup(fakeApi(), storage)
    await campaign.write(record().state, null, 0)
    expect(campaign.persistent).toBe(false)
    read.mockRestore()
    expect(storage.getItem(campaignAccountKey('g1'))).toBe('unreadable')
  })

  it('un rechazo definitivo conserva el UUID y no ofrece un reintento que pueda sobrescribir', async () => {
    const { api, campaign, storage } = await setup()
    api.saveCampaign.mockRejectedValueOnce(serverError('campaign_operation_reused'))
    await expect(campaign.write(record().state, null, 0)).rejects.toThrow(esCampaign.invalid)
    const pending: CampaignOperation = JSON.parse(storage.getItem(campaignAccountKey('g1'))!).pending
    expect(pending.operationId).toBe(api.saveCampaign.mock.calls[0][0].operationId)
    await campaign.retry()
    expect(api.saveCampaign).toHaveBeenCalledTimes(1)
  })

  it('un conflicto al guardar el checkpoint detiene el motor y no publica una confirmación', async () => {
    const { api, campaign } = await setup()
    api.saveCampaign.mockImplementationOnce(async op => ({ operationId: op.operationId, revision: op.record.revision }))
      .mockRejectedValueOnce(serverError('campaign_revision_conflict'))
    const handle = createWorkerHandler()
    const worker: CampaignWorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate: vi.fn(),
      postMessage(command) { this.onmessage?.({ data: handle(command) } as MessageEvent) } }
    const messages: CampaignClientMessage[] = []
    const session = campaign.createSession(createCampaignWorkerClient(() => worker))
    session.subscribe(m => messages.push(m))
    await session.prepare(campaignInput())
    await vi.waitFor(() => expect(campaign.getState().status).toBe('conflict'))
    expect(messages).toHaveLength(0)
    expect(worker.terminate).toHaveBeenCalled()
    expect(campaign.read()?.battle?.checkpoint).not.toBeNull()
  })
})
