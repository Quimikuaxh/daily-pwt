import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Account } from '../../cloud/account'
import { CloudError } from '../../cloud/api'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { fakeApi, fakeCloud } from '../../test-utils/cloud'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { testMenu } from '../../test-utils/ui'
import { AppMenu } from '../menu/AppMenu'

// UT-100 · F4 (RF-93, RF-95, RF-103 a RF-111): cuenta en Ajustes y en la cabecera, rankings y amigos dentro de Estadísticas.
const TODAY = '2026-10-27'
const GOOGLE = { userId: 'g1', anonymous: false }

async function mount(session: { userId: string; anonymous: boolean } | null, api = fakeApi(), signIn = true) {
  const user = userEvent.setup()
  const storage = new MemoryStorage()
  const local = new LocalStorageStore(storage)
  const cloud = fakeCloud(session, api)
  const account = new Account(Promise.resolve(cloud), storage, local)
  await account.start()
  const view = () => <AppMenu {...testMenu(account.store, { account, accountState: account.getState() })} today={TODAY} signIn={signIn} />
  const result = render(view())
  account.subscribe(() => result.rerender(view()))
  return { user, account, cloud }
}

describe('cuenta en la interfaz (UT-100)', () => {
  it('sin cuenta: «Iniciar sesión» en la cabecera de Hoy, que lleva a Google (RF-93)', async () => {
    const { user, cloud } = await mount(null)
    const button = screen.getByRole('button', { name: 'Iniciar sesión con Google' })
    await user.click(button)
    expect(cloud.auth.signInWithGoogle).toHaveBeenCalled()
  })

  it('con cuenta no hay botón de iniciar sesión y las solicitudes pendientes se avisan en Estadísticas (RF-111)', async () => {
    await mount(GOOGLE, fakeApi({ mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 2 }) }))
    expect(screen.queryByRole('button', { name: 'Iniciar sesión con Google' })).toBeNull()
    expect(screen.getByRole('status', { name: '2 solicitudes de amistad pendientes' })).toHaveTextContent('2')
  })

  it('Ajustes: nickname cogido avisa y no cambia; cerrar sesión (RF-95, RF-96)', async () => {
    const api = fakeApi({ mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 0 }), setNickname: async () => Promise.reject(new CloudError('nickname_taken', true)) })
    const { user, cloud } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustes' })
    const input = await within(dialog).findByLabelText('Nickname')
    expect(within(dialog).getByText('Has iniciado sesión como Jose.')).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'ab')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('De 3 a 16 caracteres')
    expect(api.setNickname).not.toHaveBeenCalled()
    await user.type(input, 'cd')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ese nickname ya está cogido.')
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }))
    expect(cloud.auth.signOut).toHaveBeenCalled()
  })

  it('Estadísticas sin cuenta configurada: sin pestañas', async () => {
    const user = userEvent.setup()
    render(<AppMenu {...testMenu(new LocalStorageStore(new MemoryStorage()))} today={TODAY} />)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('Rankings: puntos del mes con empates en la misma posición y el jugador marcado; racha actual (RF-106 a RF-108)', async () => {
    const api = fakeApi({
      mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 0 }),
      pointsRanking: async () => [
        { rank: 1, nickname: 'Ana', verified: true, points: 12.5, provisional: true, me: false },
        { rank: 1, nickname: 'Bea', verified: false, points: 12.5, provisional: false, me: false },
        { rank: 3, nickname: null, verified: false, points: 4, provisional: false, me: false },
        { rank: 7, nickname: 'Jose', verified: true, points: 3, provisional: false, me: true },
      ],
      streakRanking: async () => [{ rank: 1, nickname: 'Ana', verified: true, streak: 5, me: false }],
    })
    const { user } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.click(await screen.findByRole('tab', { name: 'Rankings' }))
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent?.trim()))).toEqual([
      ['1', 'AnaCon cuenta', '12,5'],
      ['1', 'Bea', '12,5'],
      ['3', '(sin nombre)', '4'],
      ['7', 'JoseCon cuenta (tú)', '3'],
    ])
    expect(within(table).getAllByRole('img', { name: 'Con cuenta' })).toHaveLength(2)
    expect(within(table).getByRole('row', { current: true })).toHaveTextContent('Jose')
    expect(api.pointsRanking).toHaveBeenCalledWith('2026-10-01', 'global')
    expect(screen.getByText(/Provisional/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await waitFor(() => expect(api.pointsRanking).toHaveBeenCalledWith('2026-09-01', 'global'))
    await user.click(screen.getByRole('button', { name: 'Amigos' }))
    await waitFor(() => expect(api.pointsRanking).toHaveBeenCalledWith('2026-09-01', 'friends'))
    await user.click(screen.getByRole('button', { name: 'Racha actual' }))
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(api.streakRanking).toHaveBeenCalledWith('friends')
  })

  it('sin cuenta: nickname propio editable en Ajustes, con el aviso de caducidad (RF-95, RF-112, RF-113)', async () => {
    const api = fakeApi({ ensureProfile: async () => ({ nickname: 'entrenador_00042', created: true, registered: false }) })
    const { user } = await mount(null, api)
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ajustes' })
    expect(await within(dialog).findByText('Juegas sin cuenta como entrenador_00042.')).toBeInTheDocument()
    expect(within(dialog).getByText(/30 días sin jugar/)).toBeInTheDocument()
    const input = within(dialog).getByLabelText('Nickname')
    await user.clear(input)
    await user.type(input, 'Invitado')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(api.setNickname).toHaveBeenCalledWith('Invitado')
    expect(within(dialog).getByRole('button', { name: 'Iniciar sesión con Google' })).toBeInTheDocument()
  })

  it('Rankings sin cuenta: se ven, con la invitación a iniciar sesión y sin vista de amigos (RF-109)', async () => {
    const { user } = await mount(null)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.click(await screen.findByRole('tab', { name: 'Rankings' }))
    expect(await screen.findByText(/Inicia sesión para ver el ranking de tus amigos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Amigos' })).toBeDisabled()
    await user.click(await screen.findByRole('tab', { name: 'Amigos' }))
    expect(screen.getByText('Inicia sesión para añadir amigos.')).toBeInTheDocument()
  })

  it('Amigos: buscar y añadir, aceptar una solicitud recibida (RF-110)', async () => {
    const api = fakeApi({
      mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 1 }),
      listFriends: async () => [{ nickname: 'Eva', relation: 'incoming' }],
      searchPlayers: async () => [{ nickname: 'Fede', relation: 'none' }],
    })
    const { user } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.click(await screen.findByRole('tab', { name: 'Amigos (1)' }))
    const incoming = await screen.findByRole('heading', { name: 'Solicitudes recibidas' })
    await user.click(within(incoming.parentElement as HTMLElement).getByRole('button', { name: 'Aceptar' }))
    expect(api.respondFriendRequest).toHaveBeenCalledWith('Eva', true)
    await user.type(screen.getByLabelText('Buscar por nickname'), 'fe')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await user.click(await screen.findByRole('button', { name: 'Añadir' }))
    expect(api.sendFriendRequest).toHaveBeenCalledWith('Fede')
  })

  it('Yo: puntos del mes y de hoy, provisionales hasta el cierre (RF-103, RF-105)', async () => {
    const api = fakeApi({
      mySummary: async () => ({
        nickname: 'Jose',
        registered: true,
        points: [
          { date: '2026-09-30', points: 9, provisional: false },
          { date: '2026-10-26', points: 4.5, provisional: false },
          { date: TODAY, points: 7.25, provisional: true },
        ],
        incomingRequests: 0,
      }),
    })
    const { user } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    expect(await screen.findByTestId('stats-month-points')).toHaveTextContent('11,75')
    expect(screen.getByTestId('stats-today-points')).toHaveTextContent('7,25 (provisional)')
  })
})
