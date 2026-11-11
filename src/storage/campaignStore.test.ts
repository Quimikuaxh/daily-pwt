import { describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_STORAGE_KEY, LocalCampaignStore } from './campaignStore'
import { STORAGE_KEY } from './localStorageStore'
import { MemoryStorage } from '../test-utils/memoryStorage'
import { campaignInput } from '../test-utils/campaign'

const source = () => { const input = campaignInput(); return { state: input.state, preparation: input.preparation, selected: input.selected } }

describe('registro local versionado de campaña', () => {
  it('persiste el prefijo de historia anterior al reclutamiento y rechaza un tamaño mayor que el historial', () => {
    const storage = new MemoryStorage()
    const state = source().state
    state.members = state.members.map(member => ({ ...member, recruitmentHistoryLength: member.history.length }))
    new LocalCampaignStore(storage).write(state, null, 0)
    expect(new LocalCampaignStore(storage).read()!.state.members[0].recruitmentHistoryLength).toBe(state.members[0].history.length)
    const record = JSON.parse(storage.getItem(CAMPAIGN_STORAGE_KEY)!)
    record.state.members[0].recruitmentHistoryLength++
    storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(record))
    expect(() => new LocalCampaignStore(storage).read()).toThrow(/conservado/)
  })
  it('conserva la cobertura del draft y rechaza valores no booleanos sin sobrescribirlos', () => {
    const storage = new MemoryStorage()
    const store = new LocalCampaignStore(storage)
    store.write({ ...source().state, draftTypeCovered: true }, null, 0)
    expect(new LocalCampaignStore(storage).read()!.state.draftTypeCovered).toBe(true)
    const raw = JSON.parse(storage.getItem(CAMPAIGN_STORAGE_KEY)!)
    raw.state.draftTypeCovered = 'true'
    storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(raw))
    expect(() => new LocalCampaignStore(storage).read()).toThrow(/conservado/)
  })
  it('guarda preparación y campaña separadas del diario y devuelve copias', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, 'diario intacto')
    const store = new LocalCampaignStore(storage)
    const initial = source()
    const saved = store.write(initial.state, { source: initial, init: null, decisions: [], checkpoint: null }, 0)
    expect(saved).toMatchObject({ version: 1, revision: 1 })
    initial.state.members = initial.state.members.map(member => ({ ...member, fainted: true }))
    saved.state.members = saved.state.members.map(member => ({ ...member, fainted: true }))
    const loaded = new LocalCampaignStore(storage)
    expect(loaded.read()!.state.members[0].fainted).toBe(false)
    expect(loaded.persistent).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe('diario intacto')
  })

  it.each(['{', 'null', '{"version":2}', '{"version":1,"revision":1,"state":{},"battle":null}'])('conserva sin sobrescribir un formato desconocido o corrupto: %s', raw => {
    const storage = new MemoryStorage()
    storage.setItem(CAMPAIGN_STORAGE_KEY, raw)
    const store = new LocalCampaignStore(storage)
    expect(() => store.read()).toThrow(/conservado/)
    expect(() => store.write(source().state, null, 0)).toThrow(/conservado/)
    expect(storage.getItem(CAMPAIGN_STORAGE_KEY)).toBe(raw)
  })

  it('funciona en memoria cuando el almacenamiento está bloqueado o no existe', () => {
    const storage = new MemoryStorage()
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    for (const target of [null, storage]) {
      const store = new LocalCampaignStore(target)
      store.write(source().state, null, 0)
      expect(store.read()!.revision).toBe(1)
      expect(store.persistent).toBe(false)
    }
  })

  it('conserva la memoria ante cuota llena y reintenta guardar en el siguiente cambio', () => {
    const storage = new MemoryStorage()
    const store = new LocalCampaignStore(storage)
    const fail = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('cuota') })
    store.write(source().state, null, 0)
    expect(store.read()!.revision).toBe(1)
    expect(store.persistent).toBe(false)
    fail.mockRestore()
    store.write(source().state, null, 1)
    expect(store.persistent).toBe(true)
    expect(new LocalCampaignStore(storage).read()!.revision).toBe(2)
  })

  it('rechaza una escritura con revisión atrasada', () => {
    const store = new LocalCampaignStore(new MemoryStorage())
    store.write(source().state, null, 0)
    expect(() => store.write(source().state, null, 0)).toThrow(/cambiado/)
    expect(store.read()!.revision).toBe(1)
  })
})
