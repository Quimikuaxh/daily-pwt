import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createCampaign } from '../../core/nuzlocke/campaign'
import { loadGameData } from '../../data/gameData'
import { AccountCampaign } from '../../cloud/campaign'
import { CloudError } from '../../cloud/api'
import { fakeApi, networkError } from '../../test-utils/cloud'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { mockCampaignCanvas } from '../../test-utils/campaignUi'
import type { CampaignRecord } from '../../storage/campaignStore'
import CampaignScreen from './CampaignScreen'
import { campaignAccountKey } from '../../cloud/campaign'
import type { CampaignBattleClient } from '../../battle/client'

// UT-193 · Campaña guardada en la cuenta (D4 en D7, GUARDADO.md y PRD §0): carga, guarda en la cuenta, conflicto con «Recargar
// campaña» (sin recargar solo) y sin conexión con «Reintentar».
mockCampaignCanvas()
const data = loadGameData()
const remote = (seed: string, revision: number): CampaignRecord => ({ version: 1, revision, state: createCampaign(seed), battle: null })
const mount = (api = fakeApi()) => {
  const cloud = new AccountCampaign(new MemoryStorage())
  cloud.setAccount(api, 'g1')
  render(<CampaignScreen data={data} cloud={cloud} newSeed={() => 'cuenta'} onExit={vi.fn()} />)
  return { api, cloud, user: userEvent.setup() }
}

describe('campaña en la cuenta', () => {
  it('carga la campaña de la cuenta al abrir y guarda las decisiones en ella', async () => {
    const { api, user } = mount(fakeApi({ getCampaign: vi.fn(async () => null) }))
    await user.click(await screen.findByRole('button', { name: 'Empezar campaña' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    await waitFor(() => expect(api.saveCampaign).toHaveBeenCalledOnce())
    expect(api.saveCampaign.mock.calls[0][0]).toMatchObject({ expectedRevision: 0, record: { revision: 1, state: { seed: 'cuenta' } } })
    expect(await screen.findByRole('button', { name: 'Continuar: reclutar (1 de 4) · preparar el gimnasio 1' })).toBeEnabled()
  })

  it('abre la campaña guardada en la cuenta', async () => {
    mount(fakeApi({ getCampaign: vi.fn(async () => remote('remota', 3)) }))
    expect(await screen.findByRole('button', { name: 'Continuar: reclutar (1 de 4) · preparar el gimnasio 1' })).toBeInTheDocument()
  })

  it('en conflicto bloquea, avisa y solo recarga al pulsar «Recargar campaña»', async () => {
    const api = fakeApi({ getCampaign: vi.fn(async () => null), saveCampaign: vi.fn(async () => { throw new CloudError('campaign_revision_conflict', true) }) })
    const { user } = mount(api)
    await user.click(await screen.findByRole('button', { name: 'Empezar campaña' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La campaña ha cambiado en otra pestaña o dispositivo')
    expect(api.getCampaign).toHaveBeenCalledOnce()
    api.getCampaign.mockResolvedValue(remote('otra', 2))
    await user.click(screen.getByRole('button', { name: 'Recargar campaña' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(api.getCampaign).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('button', { name: 'Continuar: reclutar (1 de 4) · preparar el gimnasio 1' })).toBeEnabled()
  })

  it('sin conexión avisa y «Reintentar» reenvía la misma operación', async () => {
    const api = fakeApi({ getCampaign: vi.fn(async () => null) })
    api.saveCampaign.mockRejectedValueOnce(networkError())
    const { user } = mount(api)
    await user.click(await screen.findByRole('button', { name: 'Empezar campaña' }))
    // Cambio de requisito (Jose, 13/11/2026): antes de empezar se elige la dificultad (Normal de entrada).
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar la campaña en tu cuenta')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(api.saveCampaign).toHaveBeenCalledTimes(2)
    expect(api.saveCampaign.mock.calls[1][0].operationId).toBe(api.saveCampaign.mock.calls[0][0].operationId)
  })
  // Producción, 13/11/2026: con una intención de guardado pendiente en caché que lleva un combate, al abrir se reenvía (estado `saving`
  // con ese registro), la pantalla se montaba y `createSession` lanzaba («Espera a que termine el guardado»): página en blanco.
  it('con un guardado pendiente que lleva un combate, espera a que termine para crear el combate', async () => {
    // Como `campaignInput` (test-utils/campaign, que lee ficheros y no carga en jsdom), sin la definición: la caché no la guarda.
    const state = { ...createCampaign('local-campaign'), phase: 'prepare' as const, encounterIndex: 0,
      members: [{ id: 'starter', species: 'treecko', level: 15, history: [], fainted: false, victories: 0 }] }
    const preparation = { unlockedMoves: [], movesByMember: { starter: ['absorb'] }, leadId: 'starter' }
    const saved: CampaignRecord = { version: 1, revision: 3, state, battle: null }
    const pending: CampaignRecord = { version: 1, revision: 4, state,
      battle: { source: { state, preparation, selected: ['starter'] }, init: null, decisions: [], checkpoint: null } }
    const storage = new MemoryStorage()
    const operationId = '00000000-0000-4000-8000-000000000001'
    storage.setItem(campaignAccountKey('g1'), JSON.stringify({ version: 1, record: saved, pending: { operationId, expectedRevision: 3, record: pending }, conflict: false }))
    let confirm = () => {}
    const api = fakeApi({
      saveCampaign: vi.fn(() => new Promise<{ revision: number; operationId: string }>((resolve) => { confirm = () => resolve({ revision: 4, operationId }) })),
      getCampaign: vi.fn(async () => pending),
    })
    const cloud = new AccountCampaign(storage)
    cloud.setAccount(api, 'g1')
    const client = { prepare: vi.fn(), resume: vi.fn(), choose: vi.fn(), forfeit: vi.fn(), finish: vi.fn(), subscribe: vi.fn(() => () => {}), terminate: vi.fn() }
    const createBattleClient = vi.fn(() => client as unknown as CampaignBattleClient)
    render(<CampaignScreen data={data} cloud={cloud} newSeed={() => 'cuenta'} onExit={vi.fn()} createBattleClient={createBattleClient} />)
    await waitFor(() => expect(cloud.getState().status).toBe('saving'))
    expect(createBattleClient).not.toHaveBeenCalled()
    confirm()
    await waitFor(() => expect(cloud.getState().status).toBe('ready'))
    await waitFor(() => expect(createBattleClient).toHaveBeenCalledTimes(1))
  })

  // UT-223 (Jose, 14/11/2026): guardando en segundo plano la pantalla no se bloquea; con un fallo, sí.
  it('mientras guarda no bloquea la pantalla; sin conexión, sí', async () => {
    let fail = (_: Error) => {}
    const api = fakeApi({ getCampaign: vi.fn(async () => null), saveCampaign: vi.fn(() => new Promise<never>((_, reject) => { fail = reject })) })
    const { cloud, user } = mount(api)
    await user.click(await screen.findByRole('button', { name: 'Empezar campaña' }))
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    await waitFor(() => expect(cloud.getState().status).toBe('saving'))
    const screenArea = document.querySelector('.campaign-cloud') as HTMLElement
    expect(screenArea.hasAttribute('inert')).toBe(false)
    expect(screenArea.getAttribute('aria-busy')).toBe('false')
    act(() => { fail(networkError()) })
    await waitFor(() => expect(cloud.getState().status).toBe('offline'))
    expect(document.querySelector('.campaign-cloud')!.hasAttribute('inert')).toBe(true)
  })

  // UT-220 (Jose, 14/11/2026, Sixto en el móvil con la cuenta): si el combate falla al arrancar, la pantalla se quedaba en negro hasta
  // recargar; ahora avisa y «Reintentar» crea otra sesión y vuelve a pedir el combate guardado.
  it('si el motor del combate falla, avisa y Reintentar vuelve a crear el combate', async () => {
    const state = { ...createCampaign('local-campaign'), phase: 'prepare' as const, encounterIndex: 0,
      members: [{ id: 'starter', species: 'treecko', level: 15, history: [], fainted: false, victories: 0 }] }
    const preparation = { unlockedMoves: [], movesByMember: { starter: ['absorb'] }, leadId: 'starter' }
    const saved: CampaignRecord = { version: 1, revision: 4, state,
      battle: { source: { state, preparation, selected: ['starter'] }, init: null, decisions: [], checkpoint: null } }
    const api = fakeApi({ getCampaign: vi.fn(async () => saved) })
    const cloud = new AccountCampaign(new MemoryStorage())
    cloud.setAccount(api, 'g1')
    const clients: { prepare: ReturnType<typeof vi.fn>; fail: () => void }[] = []
    const createBattleClient = vi.fn(() => {
      const listeners = new Set<(message: unknown) => void>()
      const client = { prepare: vi.fn(), resume: vi.fn(), choose: vi.fn(), forfeit: vi.fn(), finish: vi.fn(), terminate: vi.fn(),
        subscribe: vi.fn((listener: (message: unknown) => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }) }
      // Como `connectWorker` cuando el worker no carga: un error sin petición.
      clients.push({ prepare: client.prepare, fail: () => listeners.forEach((listener) => listener({ type: 'campaign-error', requestId: null, message: 'x' })) })
      return client as unknown as CampaignBattleClient
    })
    render(<CampaignScreen data={data} cloud={cloud} newSeed={() => 'cuenta'} onExit={vi.fn()} createBattleClient={createBattleClient} />)
    await waitFor(() => expect(clients[0]?.prepare).toHaveBeenCalledOnce())
    act(() => { clients[0].fail() })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido cargar el combate')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(createBattleClient).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(clients[1].prepare).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
