import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Account } from '../../cloud/account'
import { CloudError } from '../../cloud/api'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { cloudDay, fakeApi, fakeCloud, rankingPage } from '../../test-utils/cloud'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { testMenu } from '../../test-utils/ui'
import { AppMenu } from '../menu/AppMenu'

// El botón real lo pinta Google (DEC-70): aquí, uno que devuelve una credencial al pulsarlo.
vi.mock('../../cloud/googleIdentity', () => ({
  renderGoogleButton: async (parent: HTMLElement, onCredential: (credential: { token: string; nonce: string }) => void) => {
    const button = document.createElement('button')
    button.textContent = 'Iniciar sesión con Google'
    button.onclick = () => onCredential({ token: 'id-token', nonce: 'nonce' })
    parent.replaceChildren(button)
  },
  releaseGoogleButton: () => undefined,
}))

// UT-100 · F4 (RF-93, RF-95, RF-103 a RF-111): cuenta en Ajustes y en la cabecera, rankings y amigos dentro de Estadísticas.
const TODAY = '2026-10-27'
const GOOGLE = { userId: 'g1', anonymous: false }

async function mount(session: { userId: string; anonymous: boolean } | null, api = fakeApi()) {
  const user = userEvent.setup()
  const storage = new MemoryStorage()
  const local = new LocalStorageStore(storage)
  const cloud = fakeCloud(session, api)
  const account = new Account(Promise.resolve(cloud), storage, local)
  await account.start()
  const view = () => <AppMenu {...testMenu(account.store, { account, accountState: account.getState() })} today={TODAY} />
  const result = render(view())
  account.subscribe(() => result.rerender(view()))
  return { user, account, cloud }
}

describe('cuenta en la interfaz (UT-100)', () => {
  it('icono Cuenta en la cabecera, delante de los demás; sin cuenta, su ventana lleva a Google (RF-93)', async () => {
    const { user, cloud } = await mount(null)
    expect(within(screen.getByRole('navigation')).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Cuenta', 'Estadísticas', 'Ayuda', 'Ajustes'])
    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' })
    await user.click(await within(dialog).findByRole('button', { name: 'Iniciar sesión con Google' }))
    expect(cloud.auth.signInWithGoogle).toHaveBeenCalledWith({ token: 'id-token', nonce: 'nonce' })
    // Sin recargar: la sesión de Google se abre y la ventana pasa a la de la cuenta.
    expect(await within(dialog).findByText('Sesión iniciada con Google.')).toBeInTheDocument()
  })

  it('las solicitudes pendientes se avisan en Estadísticas (RF-111)', async () => {
    await mount(GOOGLE, fakeApi({ mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 2 }) }))
    // Puntito rojo sin número (decisión de Jose, 29/10/2026): el número lo dice el nombre del botón.
    const stats = screen.getByRole('button', { name: 'Estadísticas (2 solicitudes de amistad pendientes)' })
    expect(stats.querySelector('.header-badge')).toHaveTextContent('')
  })

  it('Cuenta: nickname cogido avisa y no cambia; cerrar sesión (RF-95, RF-96); Ajustes explica que el historial está en la cuenta', async () => {
    const api = fakeApi({ mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 0 }), setNickname: async () => Promise.reject(new CloudError('nickname_taken', true)) })
    const { user, cloud } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    const settings = await screen.findByRole('dialog', { name: 'Ajustes' })
    expect(within(settings).getByText(/se guardan en tu cuenta/)).toBeInTheDocument()
    expect(within(settings).queryByLabelText('Nickname')).toBeNull()
    await user.click(within(settings).getByRole('button', { name: 'Cerrar' }))
    // RF-96b: con cuenta de Google, el icono lleva el tick y el nickname.
    expect(screen.getByRole('button', { name: 'Cuenta: Jose (con cuenta de Google)' })).toHaveTextContent('Jose')
    expect(within(screen.getByRole('navigation')).getByRole('img', { name: 'Con cuenta' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Cuenta/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' })
    const input = await within(dialog).findByLabelText('Nickname')
    expect(within(dialog).getByText('Sesión iniciada con Google.')).toBeInTheDocument()
    expect(input).toHaveValue('Jose')
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
      pointsRanking: async () =>
        rankingPage([
          { rank: 1, nickname: 'Ana', verified: true, points: 12.5, provisional: false, me: false },
          { rank: 1, nickname: 'Bea', verified: false, points: 12.5, provisional: false, me: false },
          { rank: 3, nickname: null, verified: false, points: 4, provisional: false, me: false },
          { rank: 7, nickname: 'Jose', verified: true, points: 3, provisional: false, me: true },
        ]),
      streakRanking: async () => rankingPage([{ rank: 1, nickname: 'Ana', verified: true, streak: 5, me: false }]),
    })
    const { user } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.click(await screen.findByRole('tab', { name: 'Rankings' }))
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent?.trim()))).toEqual([
      ['1', 'AnaCon cuenta', '12,5'],
      ['1', 'Bea', '12,5'],
      ['3', '(sin nombre)', '4'],
      ['7', 'JoseCon cuenta(tú)', '3'],
    ])
    expect(within(table).getAllByRole('img', { name: 'Con cuenta' })).toHaveLength(2)
    expect(within(table).getByRole('row', { current: true })).toHaveTextContent('Jose')
    expect(api.pointsRanking).toHaveBeenCalledWith('2026-10-01', 'global', null)
    expect(screen.queryByRole('navigation', { name: 'Páginas del ranking' })).toBeNull()
    expect(screen.getByText(/Solo cuentan los días ya cerrados/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await waitFor(() => expect(api.pointsRanking).toHaveBeenCalledWith('2026-09-01', 'global', null))
    await user.click(screen.getByRole('button', { name: 'Solo amigos' }))
    await waitFor(() => expect(api.pointsRanking).toHaveBeenCalledWith('2026-09-01', 'friends', null))
    await user.click(screen.getByRole('button', { name: 'Racha' }))
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(api.streakRanking).toHaveBeenCalledWith('friends', null)
  })

  it('Rankings por páginas de 20: se abre en la del jugador, se pasa de página y se vuelve a la suya (RF-108)', async () => {
    const row = (rank: number, me = false) => ({ rank, nickname: me ? 'Jose' : `Jugador_${rank}`, verified: true, points: 100 - rank, provisional: false, me })
    const pages: Record<string, ReturnType<typeof rankingPage<ReturnType<typeof row>>>> = {
      mine: rankingPage([row(41, true), row(42)], { page: 3, pages: 4, total: 70, myPage: 3 }),
      4: rankingPage([row(61)], { page: 4, pages: 4, total: 70, myPage: 3 }),
    }
    const api = fakeApi({
      mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 0 }),
      pointsRanking: async (_month: string, _scope: string, page: number | null) => pages[page === null || page === 3 ? 'mine' : page],
    })
    const { user } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.click(await screen.findByRole('tab', { name: 'Rankings' }))
    const pagination = await screen.findByRole('navigation', { name: 'Páginas del ranking' })
    expect(pagination).toHaveTextContent('Página 3 de 4')
    expect(within(pagination).queryByRole('button', { name: 'Ir a mi posición' })).toBeNull()
    await user.click(within(pagination).getByRole('button', { name: 'Página siguiente' }))
    expect(await screen.findByText('Jugador_61')).toBeInTheDocument()
    expect(api.pointsRanking).toHaveBeenLastCalledWith('2026-10-01', 'global', 4)
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Ir a mi posición' }))
    expect(await screen.findByText('Jugador_42')).toBeInTheDocument()
    expect(api.pointsRanking).toHaveBeenLastCalledWith('2026-10-01', 'global', 3)
  })

  it('sin cuenta: nickname propio editable en Cuenta, con el aviso de caducidad (RF-95, RF-112, RF-113)', async () => {
    const api = fakeApi({ ensureProfile: async () => ({ nickname: 'entrenador_00042', created: true, registered: false }) })
    const { user } = await mount(null, api)
    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' })
    expect(await within(dialog).findByText('Juegas sin cuenta.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Nickname')).toHaveValue('entrenador_00042')
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
    expect(screen.getByRole('button', { name: 'Solo amigos' })).toBeDisabled()
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
    await user.click(screen.getByRole('button', { name: 'Estadísticas (1 solicitud de amistad pendiente)' }))
    const friendsTab = await screen.findByRole('tab', { name: 'Amigos: 1 solicitud de amistad pendiente' })
    // RF-111: bolita naranja con el número.
    expect(friendsTab.querySelector('.tab-badge')).toHaveTextContent('1')
    await user.click(friendsTab)
    const incoming = await screen.findByRole('heading', { name: 'Solicitudes recibidas' })
    await user.click(within(incoming.parentElement as HTMLElement).getByRole('button', { name: 'Aceptar' }))
    expect(api.respondFriendRequest).toHaveBeenCalledWith('Eva', true)
    await user.type(screen.getByLabelText('Buscar por nickname'), 'fe')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await user.click(await screen.findByRole('button', { name: 'Añadir' }))
    expect(api.sendFriendRequest).toHaveBeenCalledWith('Fede')
  })

  it('mientras cargan, Amigos y Rankings enseñan la Poké Ball de carga en vez de una lista vacía (UT-115, DEC-72)', async () => {
    let answerFriends = (_rows: never[]) => undefined as void
    const api = fakeApi({
      mySummary: async () => ({ nickname: 'Jose', registered: true, points: [], incomingRequests: 0 }),
      listFriends: () => new Promise((resolve) => (answerFriends = resolve)),
      pointsRanking: () => new Promise(() => undefined),
    })
    const { user } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.click(await screen.findByRole('tab', { name: 'Rankings' }))
    expect((await screen.findByRole('status')).querySelector('.loading-ball')).not.toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Amigos' }))
    const loading = await screen.findByText('Cargando…')
    expect(loading.closest('.loading')?.querySelector('.loading-ball')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Tus amigos' })).toBeNull()
    answerFriends([])
    expect(await screen.findByText('Aún no tienes amigos añadidos.')).toBeInTheDocument()
    expect(screen.queryByText('Cargando…')).toBeNull()
  })

  it('Yo: puntos del mes (solo días cerrados) y, de hoy, los Pokémon en pie hasta el cierre (RF-103, RF-105)', async () => {
    const api = fakeApi({
      mySummary: async () => ({
        nickname: 'Jose',
        registered: true,
        points: [
          { date: '2026-09-30', points: 9, provisional: false },
          { date: '2026-10-26', points: 4.5, provisional: false },
          { date: '2026-10-25', points: 7.25, provisional: false },
        ],
        incomingRequests: 0,
      }),
      myDays: async () => [cloudDay({ date: TODAY, status: 'won', survivors: 4 })],
    })
    const { user } = await mount(GOOGLE, api)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    expect(await screen.findByTestId('stats-month-points')).toHaveTextContent('11,75')
    expect(screen.getByTestId('stats-today-survivors')).toHaveTextContent('4/6')
    expect(screen.getByText(/Los puntos de hoy se calculan a medianoche/)).toBeInTheDocument()
    expect(screen.queryByText(/provisional/i)).toBeNull()
  })

})
