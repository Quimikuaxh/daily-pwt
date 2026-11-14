import { afterEach, expect, it } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { LocalStorageStore } from './storage/localStorageStore'
import { makeGameData } from './test-utils/fixtures'
import { mockClient } from './test-utils/clientMock'
import { mockCampaignCanvas } from './test-utils/campaignUi'

import { LocalCampaignStore } from './storage/campaignStore'
import { createCampaign } from './core/nuzlocke/campaign'
import { fakeApi, fakeCloud } from './test-utils/cloud'

mockCampaignCanvas()
afterEach(() => window.localStorage.clear())

it('Hoy → Modos → Nuzlocke de Hoenn → Volver a Hoy', async () => {
  const user = userEvent.setup()
  render(<App data={makeGameData()} store={new LocalStorageStore(null)} createClient={() => mockClient() as any} />)
  expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Modos de juego' }))
  await user.click(await screen.findByRole('button', { name: /^Nuzlocke de Hoenn/ }))
  expect(await screen.findByRole('heading', { name: 'Ruta' }, { timeout: 5000 })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Ficha de Petra' })).toHaveTextContent('LÍDER PETRA')
  await user.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
  expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Ruta' })).not.toBeInTheDocument()
})

it('Modos abre Teselia sin ganchos de prueba', async () => {
  const user = userEvent.setup()
  render(<App data={makeGameData()} store={new LocalStorageStore(null)} createClient={() => mockClient() as any} />)
  await user.click(screen.getByRole('button', { name: 'Modos de juego' }))
  const entry = await screen.findByRole('button', { name: /^Nuzlocke de Teselia/ })
  expect(entry).toHaveAccessibleDescription('Campaña con draft de Pokémon contra los gimnasios y la Liga de Negro 2 y Blanco 2')
  await user.click(entry)
  expect(await screen.findByRole('region', { name: 'Ficha de Cheren' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
  expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
})

it.each([
  [undefined, 0, 'draft', 'Medallas 0/8'],
  [undefined, 3, 'prepare', 'Medallas 3/8'],
  [undefined, 7, 'won', 'Medallas 8/8'],
  [undefined, 8, 'prepare', 'Liga'],
  ['unova-n2b2', 3, 'prepare', 'Medallas 3/8'],
  ['unova-n2b2', 7, 'won', 'Medallas 8/8'],
  ['unova-n2b2', 8, 'prepare', 'Liga'],
] as const)('Modos marca solo la campaña local %s, encuentro %i, %s', async (campaign, encounterIndex, phase, progress) => {
  new LocalCampaignStore(window.localStorage).write({ ...createCampaign('progreso', undefined, campaign), encounterIndex, phase }, null, 0)
  const user = userEvent.setup()
  render(<App data={makeGameData()} store={new LocalStorageStore(null)} createClient={() => mockClient() as any} />)
  await user.click(screen.getByRole('button', { name: 'Modos de juego' }))
  const hoenn = await screen.findByRole('button', { name: /^Nuzlocke de Hoenn/ })
  const unova = screen.getByRole('button', { name: /^Nuzlocke de Teselia/ })
  expect(within(campaign ? unova : hoenn).getByText(`En curso · ${progress}`)).toBeInTheDocument()
  expect(within(campaign ? hoenn : unova).queryByText(/En curso/)).not.toBeInTheDocument()
})

it.each([undefined, 'unova-n2b2'] as const)('una campaña local perdida (%s) no lleva indicador', async (campaign) => {
  new LocalCampaignStore(window.localStorage).write({ ...createCampaign('perdida', undefined, campaign), phase: 'lost' }, null, 0)
  const user = userEvent.setup()
  render(<App data={makeGameData()} store={new LocalStorageStore(null)} createClient={() => mockClient() as any} />)
  await user.click(screen.getByRole('button', { name: 'Modos de juego' }))
  expect(await screen.findByRole('button', { name: /^Nuzlocke de Teselia/ })).toBeInTheDocument()
  expect(screen.queryByText(/En curso/)).not.toBeInTheDocument()
})

it.each([undefined, 'unova-n2b2'] as const)('la cuenta marca su campaña cargada (%s), sin usar la local mientras carga', async (campaign) => {
  new LocalCampaignStore(window.localStorage).write(createCampaign('local'), null, 0)
  const api = fakeApi({ getCampaign: async () => ({ version: 1, revision: 1, state: { ...createCampaign('cuenta', undefined, campaign), encounterIndex: 8, phase: 'prepare' }, battle: null }) })
  const cloud = fakeCloud({ userId: 'cuenta-campana', anonymous: false }, api)
  const user = userEvent.setup()
  render(<App data={makeGameData()} store={new LocalStorageStore(null)} cloud={Promise.resolve(cloud)} createClient={() => mockClient() as any} />)
  await waitFor(() => expect(api.myDays).toHaveBeenCalled())
  await user.click(screen.getByRole('button', { name: 'Modos de juego' }))
  expect(await screen.findByRole('button', { name: /^Nuzlocke de Teselia/ })).toBeInTheDocument()
  expect(screen.queryByText(/En curso/)).not.toBeInTheDocument()
  // Cargar la campaña desde su pantalla, volver y consultar el estado de cuenta ya disponible.
  await user.click(screen.getByRole('button', { name: campaign ? /^Nuzlocke de Teselia/ : /^Nuzlocke de Hoenn/ }))
  await user.click(await screen.findByRole('button', { name: 'Volver a Hoy' }))
  await user.click(screen.getByRole('button', { name: 'Modos de juego' }))
  const entry = await screen.findByRole('button', { name: campaign ? /^Nuzlocke de Teselia/ : /^Nuzlocke de Hoenn/ })
  expect(within(entry).getByText('En curso · Liga')).toBeInTheDocument()
  expect(screen.getAllByText(/En curso/)).toHaveLength(1)
})
