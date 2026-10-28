import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { getDailyChallenge } from './core/challenge'
import { makeGameData } from './test-utils/fixtures'
import { mkUpdate, mockClient, type MockClient } from './test-utils/clientMock'
import { settle, setMadridTime } from './test-utils/ui'
import { LAUNCH } from './test-utils/dates'
import { MemoryStorage } from './test-utils/memoryStorage'
import { LocalStorageStore } from './storage/localStorageStore'
import { cloudDay, fakeApi, fakeCloud, serverError } from './test-utils/cloud'
import { decodeReplay, encodeReplay } from './replay/replayCodec'

// UT-101 · F4 (RF-98, RF-100, RF-101, RF-104b): App replica el oficial en la base de datos; las prácticas no se envían.
vi.mock('./battle/seed', () => {
  let n = 0
  return { newBattleSeed: () => 'seed-' + ++n }
})

// El visor se carga aparte (import dinámico); con el reloj falso no da tiempo a importarlo dentro del test: se deja cargado antes.
await import('./ui/replay/replayModule')

const data = makeGameData()
const WIN = { result: 'win', reason: 'faint', turns: 10, playerAlive: 3, rivalFainted: 6, playerFainted: [true, false, true, false, true, false] }
let clients: MockClient[] = []

beforeEach(() => {
  vi.useFakeTimers()
  clients = []
})
afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

async function mountApp(cloud: ReturnType<typeof fakeCloud>) {
  setMadridTime(LAUNCH, 12, 0, 0)
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<App data={data} store={new LocalStorageStore(new MemoryStorage())} cloud={Promise.resolve(cloud)} createClient={() => { const client = mockClient(); clients.push(client); return client as any }} />)
  // La cuenta se carga aparte (import dinámico): se espera a que abra la sesión.
  await vi.waitFor(() => expect(cloud.auth.getSession).toHaveBeenCalled())
  await settle(10)
  return user
}

async function startOfficial(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: /primero/i })[1])
  await user.click(screen.getByRole('button', { name: /^combate oficial/i }))
}

describe('réplica del oficial (UT-101)', () => {
  it('empezar, cada turno y terminar se envían; el estado inicial no', async () => {
    const cloud = fakeCloud(null)
    const user = await mountApp(cloud)
    await startOfficial(user)
    await settle(10)
    const challenge = getDailyChallenge(LAUNCH, data)
    expect(cloud.api.startOfficial).toHaveBeenCalledWith(expect.objectContaining({ date: LAUNCH, trainerId: challenge.trainer.id, battle: expect.objectContaining({ leadIndex: 1 }) }), { player: challenge.playerTeam.length, rival: challenge.rivalTeam.length })
    await settle(8000)
    clients[0].emit(mkUpdate())
    await settle(8000)
    expect(cloud.api.saveTurn).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^luchar$/i }))
    await user.click(screen.getAllByRole('button', { name: /pp/i })[0])
    clients[0].emit(mkUpdate())
    await settle(8000)
    expect(cloud.api.saveTurn).toHaveBeenCalledWith(LAUNCH, [{ type: 'move', slot: 1 }], expect.objectContaining({ turn: expect.any(Number) }))
    clients[0].emit(mkUpdate({ request: null, ended: WIN }))
    await settle(8000)
    expect(cloud.api.finishOfficial).toHaveBeenCalledWith(LAUNCH, WIN, [{ type: 'move', slot: 1 }])
    // F5 (RF-120): tras el final, la repetición comprimida con los pasos que vio la pantalla.
    await vi.waitFor(() => expect(cloud.api.saveReplay).toHaveBeenCalled())
    const [date, encoded] = cloud.api.saveReplay.mock.calls[0]
    expect(date).toBe(LAUNCH)
    const replay = await decodeReplay(encoded)
    expect(replay).toMatchObject({ version: 1, playerLead: 1, ended: WIN, challenge: { date: LAUNCH } })
    expect(replay.steps).toHaveLength(3)
    expect(replay.steps.every((step) => !('request' in step))).toBe(true)
    // RF-135: desde el resultado se ve la repetición recién jugada y «Volver» regresa al resultado.
    const user2 = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user2.click(await screen.findByRole('button', { name: 'Ver repetición' }))
    expect(await screen.findByTestId('battle-mode')).toHaveAttribute('data-mode', 'replay')
    await user2.click(screen.getByRole('button', { name: 'Al final' }))
    for (let second = 0; second < 15; second++) await settle(1_000)
    // Al acabar se queda en la repetición, con el resultado (RF-130): no vuelve sola al resultado del combate.
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'replay')
    expect(screen.getByText(/^Victoria · 10 turnos/)).toBeInTheDocument()
    await user2.click(screen.getAllByRole('button', { name: 'Volver' })[0])
    expect(await screen.findByRole('button', { name: 'Compartir repetición' })).toBeInTheDocument()
  })

  it('F5: un enlace `?replay=<id>` abre su repetición sin pasar por Hoy (RF-131, RF-132)', async () => {
    const challenge = getDailyChallenge(LAUNCH, data)
    const { view } = mkUpdate() as { view: unknown }
    const encoded = await encodeReplay({ version: 1, challenge, playerLead: 0, battleSeed: 's', ai: 'heuristic', steps: [{ lines: [], view: view as never }, { lines: ['|win|Jugador'], view: view as never, ended: WIN as never }], ended: WIN as never })
    const cloud = fakeCloud(null, fakeApi({ getSharedReplay: async (id: string) => ({ id, nickname: 'Jose', date: LAUNCH, challengeNumber: 1, trainerId: challenge.trainer.id, data: encoded, mine: false }) }))
    window.history.replaceState(null, '', '/?replay=abcde12345')
    await mountApp(cloud)
    await vi.waitFor(() => expect(cloud.api.getSharedReplay).toHaveBeenCalledWith('abcde12345'))
    expect(await screen.findByTestId('battle-mode')).toHaveAttribute('data-mode', 'replay')
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getAllByRole('button', { name: 'Volver' })[0])
    expect(window.location.search).toBe('')
    expect(screen.getByRole('button', { name: /^combate oficial/i })).toBeInTheDocument()
  })

  it('F5: un enlace que no existe avisa y lleva a Hoy (RF-134)', async () => {
    const cloud = fakeCloud(null, fakeApi({ getSharedReplay: async () => Promise.reject(serverError('replay_not_found')) }))
    window.history.replaceState(null, '', '/?replay=zzzzz00000')
    await mountApp(cloud)
    expect(await screen.findByText('Esta repetición no existe o se ha borrado.')).toBeInTheDocument()
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Ir al reto de hoy' }))
    expect(window.location.search).toBe('')
  })

  it('las prácticas no se envían', async () => {
    const cloud = fakeCloud(null)
    const user = await mountApp(cloud)
    await user.click(screen.getAllByRole('button', { name: /primero/i })[0])
    await user.click(screen.getByRole('button', { name: /^pr[aá]ctica$/i }))
    await settle(8000)
    expect(cloud.api.startOfficial).not.toHaveBeenCalled()
  })

  it('RF-98: si el oficial ya estaba empezado en otro dispositivo, vuelve a Hoy con aviso y ofrece reanudar aquel', async () => {
    const theirs = cloudDay({ date: LAUNCH, status: 'inProgress', finishedAt: null, turns: null, survivors: null, playerFainted: null, rivalFainted: null, endReason: null, battle: { seed: 'otra', ai: 'heuristic', leadIndex: 0, decisions: [], checkpoint: null } })
    const cloud = fakeCloud({ userId: 'g1', anonymous: false }, fakeApi({ startOfficial: async () => ({ created: false, day: theirs }) }))
    const user = await mountApp(cloud)
    await startOfficial(user)
    await settle(10)
    expect(screen.getByText(/en otro dispositivo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^combate oficial/i })).toHaveTextContent(/reanudar/i)
  })
})
