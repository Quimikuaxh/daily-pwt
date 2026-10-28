import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { getDailyChallenge } from './core/challenge'
import { makeGameData } from './test-utils/fixtures'
import { mkUpdate, mockClient, type MockClient } from './test-utils/clientMock'
import { settle, setMadridTime } from './test-utils/ui'
import { LAUNCH, addDays } from './test-utils/dates'
import { LocalStorageStore } from './storage/localStorageStore'

// CMP-24 · DEC-16, DEC-17 · REQUISITOS §5. Navegación today -> battle -> result -> today/battle.
// TODO-CONTRATO: src/App.tsx exporta por defecto <App data={GameData} createClient={() => BattleClient} />;
//   la semilla de cada combate sale de newBattleSeed() (src/battle/seed.ts, aquí simulada). Navegación por máquina de estados, sin router.
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
afterEach(() => { vi.useRealTimers() })

function mountApp(date = LAUNCH, h = 12, mi = 0, s = 0) {
  setMadridTime(date, h, mi, s)
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<App data={data} store={new LocalStorageStore(null)} createClient={() => { const c = mockClient(); clients.push(c); return c as any }} />)
  return user
}
const initCalls = () => clients.flatMap((c) => c.init.mock.calls.map((x) => x[0]))
async function startBattle(user: ReturnType<typeof userEvent.setup>, lead = 2, mode: 'official' | 'practice' = 'official') {
  await user.click(screen.getAllByRole('button', { name: /primero/i })[lead])
  await user.click(screen.getByRole('button', { name: mode === 'official' ? /combate oficial/i : /pr[aá]ctica/i }))
}
async function finish(win = WIN) {
  clients[clients.length - 1].emit(mkUpdate({ request: null, ended: win }))
  await settle()
}

describe('navegación', () => {
  it('arranca en Hoy', () => {
    mountApp()
    expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  })

  it('Combate oficial lleva a la pantalla de combate e inicia el motor con el reto, el inicial y una semilla nueva', async () => {
    const user = mountApp()
    await startBattle(user, 2)
    const c = getDailyChallenge(LAUNCH, data)
    expect(screen.getByTestId('battle-screen')).toBeInTheDocument()
    expect(initCalls()[0]).toMatchObject({ battleSeed: 'seed-1', playerLead: 2, player: c.playerTeam, rival: c.rivalTeam })
  })

  it('al terminar el combate aparece Resultado', async () => {
    const user = mountApp()
    await startBattle(user)
    await finish()
    expect(screen.getByRole('heading')).toHaveTextContent(/victoria/i)
  })

  it('"Volver a Hoy" regresa a Hoy', async () => {
    const user = mountApp()
    await startBattle(user)
    await finish()
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  })

  it('"Otro combate" repite el mismo reto con un battleSeed nuevo', async () => {
    const user = mountApp()
    await startBattle(user, 2)
    await finish()
    await user.click(screen.getByRole('button', { name: /otro combate/i }))
    const [first, second] = initCalls()
    expect(second.battleSeed).not.toBe(first.battleSeed)
    expect([second.player, second.rival]).toEqual([first.player, first.rival])
    expect(screen.getByTestId('battle-screen')).toBeInTheDocument()
  })

  it('"Otro combate" mantiene el mismo inicial elegido', async () => {
    const user = mountApp()
    await startBattle(user, 4)
    await finish()
    await user.click(screen.getByRole('button', { name: /otro combate/i }))
    expect(initCalls()[1].playerLead).toBe(4)
  })

  it('tras volver a Hoy se puede combatir de nuevo (tercer combate con semilla distinta)', async () => {
    const user = mountApp()
    await startBattle(user)
    await finish()
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    await startBattle(user, 2, 'practice')
    const seeds = initCalls().map((i) => i.battleSeed)
    expect(new Set(seeds).size).toBe(seeds.length)
  })

  it('Salir del combate (confirmado) vuelve a Hoy y descarta la partida', async () => {
    const user = mountApp()
    await startBattle(user)
    await user.click(screen.getByRole('button', { name: /salir/i }))
    await user.click(screen.getByRole('button', { name: /confirmar|s[ií]|salir/i }))
    expect(screen.queryByTestId('battle-screen')).toBeNull()
    expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  })

  it('un error del worker deja volver a Hoy', async () => {
    const user = mountApp()
    await startBattle(user)
    clients[0].emit({ type: 'error', message: 'x' })
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(screen.getByRole('button', { name: /combate oficial/i })).toBeInTheDocument()
  })
})

describe('medianoche en combate (REQUISITOS §5)', () => {
  it('con combate en curso sigue el reto con que empezó: la pantalla de combate no cambia', async () => {
    const user = mountApp(LAUNCH, 23, 59, 50)
    await startBattle(user)
    await settle(20_000)
    expect(screen.getByTestId('battle-screen')).toBeInTheDocument()
    expect(initCalls()).toHaveLength(1)
  })

  it('el "Otro combate" tras la medianoche sigue usando el reto original', async () => {
    const user = mountApp(LAUNCH, 23, 59, 50)
    await startBattle(user)
    await settle(20_000)
    await finish()
    await user.click(screen.getByRole('button', { name: /otro combate/i }))
    const c1 = getDailyChallenge(LAUNCH, data)
    expect(initCalls()[1].rival).toEqual(c1.rivalTeam)
  })

  it('al volver a Hoy se muestra el reto nuevo (#2)', async () => {
    const user = mountApp(LAUNCH, 23, 59, 50)
    await startBattle(user)
    await settle(20_000)
    await finish()
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(screen.getByRole('banner')).toHaveTextContent('#2')
  })
})
