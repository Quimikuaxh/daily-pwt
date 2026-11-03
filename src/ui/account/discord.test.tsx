import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Account } from '../../cloud/account'
import { discordResultFrom, discordStartUrl, formatMinute, REMINDER_MINUTES, withoutDiscordParam } from '../../cloud/discordLink'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { fakeApi, fakeCloud, networkError } from '../../test-utils/cloud'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { testMenu } from '../../test-utils/ui'
import { AppMenu } from '../menu/AppMenu'
import { DiscordSection } from './DiscordSection'

vi.mock('../../cloud/googleIdentity', () => ({ renderGoogleButton: async () => undefined, releaseGoogleButton: () => undefined }))

// UT-142 · Aviso por Discord en Cuenta (RF-115 a RF-119, DEC-77).
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const LINKED = { name: 'Jose', enabled: true, minute: 1200, timeZone: ZONE, failed: false }

async function mountMenu(session: { userId: string; anonymous: boolean } | null, api = fakeApi()) {
  const storage = new MemoryStorage()
  const account = new Account(Promise.resolve(fakeCloud(session, api)), storage, new LocalStorageStore(storage))
  await account.start()
  const view = () => <AppMenu {...testMenu(account.store, { account, accountState: account.getState() })} today="2026-11-03" />
  const result = render(view())
  account.subscribe(() => result.rerender(view()))
  return { user: userEvent.setup(), api }
}

afterEach(() => window.history.replaceState(null, '', '/'))

describe('aviso por Discord (UT-142)', () => {
  it('la dirección: empezar con el state, leer y quitar el resultado; horas de media en media', () => {
    expect(discordStartUrl('https://p.supabase.co/functions/v1', 'a b')).toBe('https://p.supabase.co/functions/v1/pwt-discord?start=a%20b')
    expect(discordResultFrom('?discord=ok')).toBe('ok')
    expect(discordResultFrom('?x=1&discord=cancelled')).toBe('cancelled')
    expect(discordResultFrom('?discord=otra')).toBeNull()
    expect(withoutDiscordParam('https://x.io/daily-pwt/?discord=ok&replay=abc')).toBe('https://x.io/daily-pwt/?replay=abc')
    expect(REMINDER_MINUTES).toHaveLength(48)
    expect(formatMinute(1230)).toBe('20:30')
    expect(formatMinute(0)).toBe('00:00')
  })

  it('con cuenta, Cuenta ofrece conectar Discord', async () => {
    const { user, api } = await mountMenu({ userId: 'g1', anonymous: false })
    await user.click(screen.getByRole('button', { name: /^Cuenta/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' })
    expect(await within(dialog).findByRole('heading', { name: 'Aviso por Discord' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Conectar Discord' })).toBeInTheDocument()
    expect(api.discordReminder).toHaveBeenCalled()
  })

  it('«Conectar Discord» lleva a la dirección del servidor, pedida con la zona del dispositivo', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    const navigate = vi.fn()
    render(<DiscordSection api={api} navigate={navigate} />)
    await user.click(await screen.findByRole('button', { name: 'Conectar Discord' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://proyecto.supabase.co/functions/v1/pwt-discord?start=estado'))
    expect(api.discordLinkUrl).toHaveBeenCalledWith(ZONE)
  })

  it('sin cuenta (sesión anónima) no hay aviso por Discord', async () => {
    const { user, api } = await mountMenu({ userId: 'a1', anonymous: true })
    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' })
    expect(within(dialog).queryByRole('heading', { name: 'Aviso por Discord' })).toBeNull()
    expect(api.discordReminder).not.toHaveBeenCalled()
  })

  it('conectado: cambia el interruptor y la hora (guardados con la zona del dispositivo), avisa si no llegó y se desconecta', async () => {
    const user = userEvent.setup()
    const api = fakeApi({ discordReminder: async () => ({ ...LINKED, failed: true }) })
    render(<DiscordSection api={api} />)
    expect(await screen.findByText('Conectado como Jose.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('El último mensaje no te llegó')
    expect(screen.getByRole('combobox', { name: 'Hora' })).toHaveDisplayValue('20:00')

    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(api.setDiscordReminder).toHaveBeenLastCalledWith(false, 1200, ZONE)
    expect(await screen.findByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Hora' }), '07:30')
    expect(api.setDiscordReminder).toHaveBeenLastCalledWith(false, 450, ZONE)
    expect(await screen.findByRole('status')).toHaveTextContent('Aviso guardado.')

    await user.click(screen.getByRole('button', { name: 'Desconectar Discord' }))
    expect(await screen.findByRole('button', { name: 'Conectar Discord' })).toBeInTheDocument()
    expect(api.discordUnlink).toHaveBeenCalled()
  })

  it('elegida en otra zona lo dice; si no se puede guardar, avisa y no cambia', async () => {
    const user = userEvent.setup()
    const api = fakeApi({ discordReminder: async () => ({ ...LINKED, timeZone: 'Pacific/Kiritimati' }), setDiscordReminder: async () => Promise.reject(networkError()) })
    render(<DiscordSection api={api} />)
    expect(await screen.findByText(/se eligió en otra zona \(Pacific\/Kiritimati\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar')
    expect(screen.getByRole('button', { name: 'Sí' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('al volver de Discord (?discord=ok) se abre Cuenta con el resultado y el parámetro se quita', async () => {
    window.history.replaceState(null, '', '/?discord=ok')
    await mountMenu({ userId: 'g1', anonymous: false }, fakeApi({ discordReminder: async () => LINKED }))
    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' })
    expect(await within(dialog).findByText('Discord conectado.')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })
})
