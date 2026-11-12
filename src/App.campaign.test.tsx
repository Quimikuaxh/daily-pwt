import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { LocalStorageStore } from './storage/localStorageStore'
import { makeGameData } from './test-utils/fixtures'
import { mockClient } from './test-utils/clientMock'
import { mockCampaignCanvas } from './test-utils/campaignUi'

mockCampaignCanvas()

it('Hoy → Modos → Nuzlocke de Hoenn → Volver a Hoy', async () => {
  const user = userEvent.setup()
  render(<App data={makeGameData()} store={new LocalStorageStore(null)} createClient={() => mockClient() as any} />)
  expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Modos de juego' }))
  await user.click(await screen.findByRole('button', { name: /^Nuzlocke de Hoenn/ }))
  expect(await screen.findByRole('heading', { name: 'Ruta' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Ficha de Petra' })).toHaveTextContent('LÍDER PETRA')
  await user.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
  expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Ruta' })).not.toBeInTheDocument()
})
