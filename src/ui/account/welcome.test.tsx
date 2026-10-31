import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Account } from '../../cloud/account'
import { welcomeNeeds, type AccountState } from '../../cloud/state'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { dismissWelcomeForever, markWelcomeShown, welcomeDue } from '../../storage/welcomePrompt'
import { fakeApi, fakeCloud } from '../../test-utils/cloud'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { testMenu } from '../../test-utils/ui'
import { AppMenu } from '../menu/AppMenu'

vi.mock('../../cloud/googleIdentity', () => ({ renderGoogleButton: async () => undefined, releaseGoogleButton: () => undefined }))

// UT-129 · Aviso de Hoy (RF-94b; Jose, 31/10/2026): elegir nombre e iniciar sesión, como mucho una vez al día y con «No volver a mostrar».
const TODAY = '2026-10-31'
const summary = (nicknameChosen: boolean | undefined) => ({ nickname: 'entrenador_12345', nicknameChosen, registered: false, points: [], incomingRequests: 0 })
const player = (status: 'guest' | 'signedIn', nicknameChosen: boolean | undefined): AccountState => ({ status, userId: 'u', nickname: 'entrenador_12345', summary: summary(nicknameChosen) })

afterEach(() => window.localStorage.clear())

describe('quién necesita el aviso', () => {
  it('sin cuenta o sin nombre elegido, sí (con lo que le falta); con las dos cosas, sin resumen o sin el dato del servidor, no', () => {
    expect(welcomeNeeds(player('guest', false))).toEqual({ name: true, account: true })
    expect(welcomeNeeds(player('guest', true))).toEqual({ name: false, account: true })
    expect(welcomeNeeds(player('signedIn', false))).toEqual({ name: true, account: false })
    expect(welcomeNeeds(player('signedIn', true))).toBeNull()
    expect(welcomeNeeds(player('guest', undefined))).toBeNull()
    expect(welcomeNeeds({ status: 'guest', userId: 'u', nickname: null, summary: null })).toBeNull()
    expect(welcomeNeeds({ status: 'offline' })).toBeNull()
    expect(welcomeNeeds(undefined)).toBeNull()
  })

  it('en el navegador: una vez al día y nunca más con «No volver a mostrar»; sin almacenamiento, toca siempre', () => {
    const storage = new MemoryStorage()
    expect(welcomeDue(storage, TODAY)).toBe(true)
    markWelcomeShown(storage, TODAY)
    expect(welcomeDue(storage, TODAY)).toBe(false)
    expect(welcomeDue(storage, '2026-11-01')).toBe(true)
    dismissWelcomeForever(storage)
    expect(welcomeDue(storage, '2026-11-02')).toBe(false)
    expect(welcomeDue(null, TODAY)).toBe(true)
  })
})

describe('aviso en Hoy', () => {
  async function mount(nicknameChosen: boolean | undefined, session = { userId: 'a1', anonymous: true }, welcome = true) {
    const storage = new MemoryStorage()
    const api = fakeApi({ mySummary: async () => summary(nicknameChosen) })
    const account = new Account(Promise.resolve(fakeCloud(session, api)), storage, new LocalStorageStore(storage))
    await account.start()
    const view = () => <AppMenu {...testMenu(account.store, { account, accountState: account.getState() })} today={TODAY} welcome={welcome} />
    const result = render(view())
    account.subscribe(() => result.rerender(view()))
    return { user: userEvent.setup(), result }
  }

  it('sin cuenta y sin nombre: habla de las dos cosas; «Ir a Cuenta» abre Cuenta; el mismo día no vuelve a salir', async () => {
    const { user, result } = await mount(false)
    const dialog = await screen.findByRole('dialog', { name: 'Tu nombre y tu cuenta' })
    expect(dialog).toHaveTextContent('entrenador_12345')
    expect(dialog).toHaveTextContent('Google')
    await user.click(screen.getByRole('button', { name: 'Ir a Cuenta' }))
    expect(await screen.findByRole('dialog', { name: 'Cuenta' })).toBeInTheDocument()
    result.unmount()
    await mount(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tu nombre y tu cuenta' })).toBeNull())
  })

  it('con «No volver a mostrar» marcado no vuelve a salir ningún día', async () => {
    const { user, result } = await mount(true)
    const dialog = await screen.findByRole('dialog', { name: 'Tu nombre y tu cuenta' })
    expect(dialog).not.toHaveTextContent('entrenador_12345')
    await user.click(screen.getByRole('checkbox', { name: 'No volver a mostrar' }))
    await user.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(JSON.parse(window.localStorage.getItem('daily-pwt:welcome') ?? '{}')).toMatchObject({ never: true })
    result.unmount()
  })

  it('con cuenta y nombre elegido, fuera de Hoy o con un servidor sin el dato, no sale', async () => {
    const signedIn = { userId: 'g1', anonymous: false }
    for (const [chosen, session, welcome] of [[true, signedIn, true], [false, signedIn, false], [undefined, { userId: 'a2', anonymous: true }, true]] as const) {
      const { result } = await mount(chosen, session, welcome)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      result.unmount()
    }
  })
})
