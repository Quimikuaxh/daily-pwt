import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
})
