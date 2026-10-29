import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Account } from '../../cloud/account'
import type { HistoryItem } from '../../cloud/api'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { fakeApi, fakeCloud } from '../../test-utils/cloud'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { testMenu } from '../../test-utils/ui'
import { AppMenu } from '../menu/AppMenu'
import { MatchHistoryDialog } from './MatchHistoryDialog'
import { replayIdFrom, replayLink } from './replayLink'

// UT-108 · F5 (RF-124 a RF-126, RF-131, RF-133): ventana Historial, sus accesos y el enlace compartido.
const item = (over: Partial<HistoryItem> = {}): HistoryItem => ({ date: '2026-11-02', challengeNumber: 10, trainerId: 'misty', variantId: 'misty-1', status: 'won', turns: 21, survivors: 4, playerFainted: null, sharedId: null, ...over })
const trainerName = (id: string) => ({ misty: 'Misty', brock: 'Brock' })[id] ?? id

describe('ventana Historial (UT-108)', () => {
  it('lista los oficiales del más reciente al más antiguo, con su resultado; «Ver repetición» abre el de ese día', async () => {
    const user = userEvent.setup()
    const api = fakeApi({ myHistory: async () => [item(), item({ date: '2026-11-01', challengeNumber: 9, trainerId: 'brock', status: 'lost', turns: 12, survivors: 0 })] })
    const onWatch = vi.fn()
    render(<MatchHistoryDialog api={api} trainerName={trainerName} onWatch={onWatch} onClose={vi.fn()} />)
    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('#10 · 02/11/2026 · Misty')
    // El resultado es una copa (dorada o tachada) que se lee «Victoria» o «Derrota» (decisión de Jose, 29/10/2026).
    expect(within(items[0]).getByRole('img', { name: 'Victoria' })).toHaveAttribute('data-won', 'true')
    expect(items[0]).toHaveTextContent('21 turnos · 4/6 en pie')
    expect(items[1]).toHaveTextContent('#9 · 01/11/2026 · Brock')
    expect(within(items[1]).getByRole('img', { name: 'Derrota' })).toHaveAttribute('data-won', 'false')
    expect(items[1].querySelector('.history-cup-cross')).not.toBeNull()
    expect(items[0].querySelector('.history-cup-cross')).toBeNull()
    expect(items[1]).toHaveTextContent('12 turnos')
    expect(items[1]).not.toHaveTextContent('en pie')
    await user.click(within(items[1]).getByRole('button', { name: 'Ver repetición' }))
    expect(onWatch).toHaveBeenCalledWith('2026-11-01')
  })

  it('«Compartir» crea el enlace y lo copia; con enlace, «Dejar de compartir» lo borra', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    let shared: string | null = null
    const api = fakeApi({
      myHistory: async () => [item({ sharedId: shared })],
      shareReplay: async () => (shared = 'abcde12345'),
      deleteSharedReplay: async () => {
        shared = null
      },
    })
    render(<MatchHistoryDialog api={api} trainerName={trainerName} onWatch={vi.fn()} onClose={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Compartir' }))
    expect(api.shareReplay).toHaveBeenCalledWith('2026-11-02')
    expect(writeText).toHaveBeenCalledWith('https://quimikuaxh.github.io/daily-pwt/?replay=abcde12345')
    expect(await screen.findByText(/Enlace copiado/)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Dejar de compartir' }))
    expect(api.deleteSharedReplay).toHaveBeenCalledWith('abcde12345')
    // Compartir de nuevo un combate ya compartido no crea otro enlace: usa el que tiene.
    shared = 'abcde12345'
    await user.click(screen.getByRole('button', { name: 'Compartir' }))
  })

  it('cada combate lleva el sprite de mapa del rival (o el de combate, si no tiene) y los iconos de caja de los 6 del equipo', async () => {
    const api = fakeApi({ myHistory: async () => [item(), item({ date: '2026-11-01', trainerId: 'brock' })] })
    const art = (entry: HistoryItem) => (entry.trainerId === 'misty' ? { trainerSprite: 'misty', team: ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic'] } : null)
    const { container } = render(<MatchHistoryDialog api={api} trainerName={trainerName} art={art} onWatch={vi.fn()} onClose={vi.fn()} />)
    const [withArt, withoutArt] = await screen.findAllByRole('listitem')
    expect(withArt.querySelector('img.history-trainer')?.getAttribute('src')).toMatch(/sprites\/trainers\/misty-mini\.png$/)
    expect(withArt.querySelectorAll('.bt-member-icon')).toHaveLength(6)
    // Sin datos para ese reto, sin dibujos (y el resto igual).
    expect(withoutArt.querySelector('img')).toBeNull()
    expect(withoutArt).toHaveTextContent('Brock')
    // Sin sprite de mapa, el de combate.
    fireEvent.error(withArt.querySelector('img.history-trainer') as HTMLImageElement)
    expect(container.querySelector('img.history-trainer-battle')?.getAttribute('src')).toMatch(/sprites\/trainers\/misty\.gif$/)
  })

  it('los debilitados del equipo van en gris, ganara o perdiera; sin ese dato, ninguno', async () => {
    const team = ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic']
    const api = fakeApi({
      myHistory: async () => [
        item({ playerFainted: [true, false, false, true, false, false] }),
        item({ date: '2026-11-01', status: 'lost', survivors: 0, playerFainted: [true, true, true, true, true, true] }),
        item({ date: '2026-10-31' }),
      ],
    })
    render(<MatchHistoryDialog api={api} trainerName={trainerName} art={() => ({ trainerSprite: 'misty', team })} onWatch={vi.fn()} onClose={vi.fn()} />)
    const dimmed = (entry: HTMLElement) => [...entry.querySelectorAll('.bt-member-icon')].map((icon) => icon.getAttribute('data-dimmed') === 'true')
    const [won, lost, unknown] = await screen.findAllByRole('listitem')
    expect(dimmed(won)).toEqual([true, false, false, true, false, false])
    expect(dimmed(lost)).toEqual([true, true, true, true, true, true])
    expect(dimmed(unknown)).toEqual([false, false, false, false, false, false])
  })

  it('mientras carga, la Poké Ball de carga (UT-115, DEC-72)', () => {
    render(<MatchHistoryDialog api={fakeApi({ myHistory: () => new Promise(() => undefined) })} trainerName={trainerName} onWatch={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.getByRole('status').querySelector('.loading-ball')).not.toBeNull()
  })

  it('sin combates, el aviso de vacío; sin servicio, el de conexión', async () => {
    const { unmount } = render(<MatchHistoryDialog api={fakeApi()} trainerName={trainerName} onWatch={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText(/Aún no hay combates en tu historial/)).toBeInTheDocument()
    unmount()
    render(<MatchHistoryDialog api={null} trainerName={trainerName} onWatch={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/necesita conexión/)).toBeInTheDocument()
  })
})

describe('accesos al historial (UT-108)', () => {
  async function mountMenu() {
    const user = userEvent.setup()
    const storage = new MemoryStorage()
    const account = new Account(Promise.resolve(fakeCloud(null)), storage, new LocalStorageStore(storage))
    await account.start()
    const onWatchReplay = vi.fn()
    render(<AppMenu {...testMenu(account.store, { account, accountState: account.getState(), trainerName, onWatchReplay })} today="2026-11-03" />)
    return { user, onWatchReplay }
  }

  it('icono Historial en la cabecera (solo en pantallas anchas) y botón en la ventana Cuenta (solo en el móvil): nunca los dos, lo decide el CSS', async () => {
    const { user } = await mountMenu()
    const icon = screen.getByRole('button', { name: 'Historial' })
    expect(icon).toHaveClass('header-action-wide')
    await user.click(screen.getByRole('button', { name: 'Cuenta' }))
    const account = await screen.findByRole('dialog', { name: 'Cuenta' })
    // Solo en el móvil (el CSS lo oculta en pantallas anchas, donde está el icono).
    expect(within(account).getByRole('button', { name: 'Historial de combates' }).closest('.account-history-mobile')).not.toBeNull()
    await user.click(within(account).getByRole('button', { name: 'Historial de combates' }))
    expect(await screen.findByRole('dialog', { name: 'Historial' })).toBeInTheDocument()
  })

  it('sin cuenta configurada no hay historial', () => {
    render(<AppMenu {...testMenu(new LocalStorageStore(new MemoryStorage()), { trainerName, onWatchReplay: vi.fn() })} today="2026-11-03" />)
    expect(screen.queryByRole('button', { name: 'Historial' })).toBeNull()
  })
})

describe('enlace compartido (UT-108)', () => {
  it('replayLink y replayIdFrom: ida y vuelta; un id con otra forma no vale', () => {
    expect(replayLink('abcde12345')).toBe('https://quimikuaxh.github.io/daily-pwt/?replay=abcde12345')
    expect(replayIdFrom('?replay=abcde12345')).toBe('abcde12345')
    expect(replayIdFrom('?replay=ABC')).toBeNull()
    expect(replayIdFrom('?trainer=misty')).toBeNull()
  })
})
