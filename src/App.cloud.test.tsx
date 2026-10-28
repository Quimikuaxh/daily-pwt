import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { getDailyChallenge } from './core/challenge'
import { makeGameData } from './test-utils/fixtures'
import { mkUpdate, mockClient, type MockClient } from './test-utils/clientMock'
import { settle, setLocalTime } from './test-utils/ui'
import { LAUNCH } from './test-utils/dates'
import { MemoryStorage } from './test-utils/memoryStorage'
import { LocalStorageStore } from './storage/localStorageStore'
import { cloudDay, fakeApi, fakeCloud } from './test-utils/cloud'

// UT-101 · F4 (RF-98, RF-100, RF-101, RF-104b): App replica el oficial en la base de datos; las prácticas no se envían.
vi.mock('./battle/seed', () => {
  let n = 0
  return { newBattleSeed: () => 'seed-' + ++n }
})

const data = makeGameData()
const WIN = { result: 'win', reason: 'faint', turns: 10, playerAlive: 3, rivalFainted: 6, playerFainted: [true, false, true, false, true, false] }
let clients: MockClient[] = []

beforeEach(() => {
  vi.useFakeTimers()
  clients = []
})
afterEach(() => {
  vi.useRealTimers()
})

async function mountApp(cloud: ReturnType<typeof fakeCloud>) {
  setLocalTime(LAUNCH, 12, 0, 0)
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
