import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { getDailyChallenge } from './core/challenge'
import { makeGameData } from './test-utils/fixtures'
import { mkUpdate, mockClient, type MockClient } from './test-utils/clientMock'
import { settle, setMadridTime } from './test-utils/ui'
import { LAUNCH, addDays } from './test-utils/dates'
import { MemoryStorage } from './test-utils/memoryStorage'
import { LocalStorageStore } from './storage/localStorageStore'

// DEC-43 · PRD §4.3 y §11 · criterios 7, 8, 9, 10: un oficial por día, reanudar, rendirse = derrota, prácticas sin efecto.
vi.mock('./battle/seed', () => {
  let n = 0
  return { newBattleSeed: () => 'seed-' + ++n }
})

const data = makeGameData()
const WIN = { result: 'win', reason: 'faint', turns: 10, playerAlive: 3, rivalFainted: 6, playerFainted: [true, false, true, false, true, false] }
const LOSS_FORFEIT = { result: 'loss', reason: 'forfeit', turns: 2, playerAlive: 3, rivalFainted: 0, playerFainted: [true, true, true, false, false, false] }
let clients: MockClient[] = []
let storage: MemoryStorage

beforeEach(() => {
  vi.useFakeTimers()
  clients = []
  storage = new MemoryStorage()
})
afterEach(() => { vi.useRealTimers() })

/** Monta la aplicación sobre el almacenamiento compartido: montar otra vez equivale a recargar la página. */
function mountApp(date = LAUNCH, h = 12, mi = 0, s = 0) {
  setMadridTime(date, h, mi, s)
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const utils = render(<App data={data} store={new LocalStorageStore(storage)} createClient={() => { const client = mockClient(); clients.push(client); return client as any }} />)
  return { user, ...utils }
}
const store = () => new LocalStorageStore(storage)
/** Deja el oficial del día ya terminado: la práctica solo se abre tras él (RF-84; Jose, 31/10/2026). */
function officialDone(date = LAUNCH) {
  const challenge = getDailyChallenge(date, data)
  store().startOfficial({ date, challengeNumber: 1, trainerId: challenge.trainer.id, variantId: challenge.variant.id, dataVersion: data.dataVersion, startedAt: new Date().toISOString(), battle: { seed: 's', ai: 'heuristic', leadIndex: 0 } })
  store().finishOfficial(date, WIN as never, new Date().toISOString())
}
const official = () => screen.getByRole('button', { name: /^combate oficial/i })
const practice = () => screen.getByRole('button', { name: /^pr[aá]ctica$/i })
const chooseLead = (user: ReturnType<typeof userEvent.setup>, index = 2) => user.click(screen.getAllByRole('button', { name: /primero/i })[index])
const lastClient = () => clients[clients.length - 1]

async function startOfficial(user: ReturnType<typeof userEvent.setup>, lead = 2) {
  await chooseLead(user, lead)
  await user.click(official())
}
async function exitBattle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^salir$/i }))
  await user.click(screen.getByRole('button', { name: /sí, salir/i }))
}

describe('un combate oficial por día', () => {
  it('queda registrado al empezarlo, con el rival, la semilla y el inicial', async () => {
    const { user } = mountApp()
    await startOfficial(user, 3)
    const challenge = getDailyChallenge(LAUNCH, data)
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'inProgress', trainerId: challenge.trainer.id, variantId: challenge.variant.id, challengeNumber: 1, battle: { seed: clients[0].init.mock.calls[0][0].battleSeed, leadIndex: 3, decisions: [] } })
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'official')
  })

  it('salir no da otro intento: Hoy ofrece Reanudar y reanudar no crea otro registro', async () => {
    const { user } = mountApp()
    await startOfficial(user)
    const savedSeed = store().getDay(LAUNCH)?.battle?.seed
    await exitBattle(user)
    expect(official()).toBeEnabled()
    expect(official()).toHaveTextContent(/reanudar/i)
    await user.click(official())
    expect(store().listDays()).toHaveLength(1)
    expect(lastClient().init.mock.calls[0][0]).toMatchObject({ battleSeed: savedSeed, playerLead: 2 })
  })

  it('al recargar a mitad de combate se reanuda: misma semilla, mismas decisiones, sin intro', async () => {
    const first = mountApp()
    await startOfficial(first.user)
    await settle(8000)
    clients[0].emit(mkUpdate())
    await settle(8000)
    await first.user.click(screen.getByRole('button', { name: /luchar/i }))
    await first.user.click(screen.getByRole('button', { name: new RegExp(data.names.moves.earthquake) }))
    expect(clients[0].choose).toHaveBeenCalledWith({ type: 'move', slot: 1 })
    expect(store().getDay(LAUNCH)?.battle?.decisions).toEqual([{ type: 'move', slot: 1 }])
    first.unmount()

    const reloaded = mountApp()
    expect(official()).toHaveTextContent(/reanudar/i)
    await reloaded.user.click(official())
    expect(screen.getByTestId('field')).toHaveAttribute('data-intro', 'done')
    expect(lastClient().init.mock.calls[0][0]).toMatchObject({ battleSeed: clients[0].init.mock.calls[0][0].battleSeed, playerLead: 2 })
    lastClient().emit(mkUpdate())
    await settle(50)
    expect(lastClient().choose).toHaveBeenCalledWith({ type: 'move', slot: 1 })
    expect(store().getDay(LAUNCH)?.battle?.decisions).toEqual([{ type: 'move', slot: 1 }])
  })

  it('terminarlo: Hoy deja el oficial deshabilitado con el resultado y no permite otro', async () => {
    const { user } = mountApp()
    await startOfficial(user)
    clients[0].emit(mkUpdate({ request: null, ended: WIN }))
    await settle()
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(official()).toBeDisabled()
    expect(official()).toHaveTextContent('Victoria · 10 turnos · 3/6 en pie')
    await user.click(official())
    expect(clients).toHaveLength(1)
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'won', turns: 10, survivors: 3 })
  })

  it('el resultado y el bloqueo siguen tras recargar', async () => {
    const first = mountApp()
    await startOfficial(first.user)
    clients[0].emit(mkUpdate({ request: null, ended: WIN }))
    await settle()
    first.unmount()
    mountApp()
    expect(official()).toBeDisabled()
    expect(official()).toHaveTextContent(/victoria/i)
  })

  it('rendirse cuenta como derrota y deshabilita el oficial', async () => {
    const { user } = mountApp()
    await startOfficial(user)
    clients[0].emit(mkUpdate())
    await settle(8000)
    await user.click(screen.getByRole('button', { name: /rendirse/i }))
    await user.click(screen.getByRole('button', { name: /sí, rendirme/i }))
    expect(clients[0].forfeit).toHaveBeenCalled()
    expect(store().getDay(LAUNCH)?.battle?.decisions).toEqual([{ type: 'forfeit' }])
    clients[0].emit(mkUpdate({ request: null, ended: LOSS_FORFEIT }))
    await settle()
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(official()).toBeDisabled()
    expect(official()).toHaveTextContent(/derrota/i)
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'lost', endReason: 'forfeit' })
  })

  it('el intento no se recupera cambiando de pestaña: empezar un oficial ya registrado retoma el existente', async () => {
    const { user } = mountApp()
    store().startOfficial({ date: LAUNCH, challengeNumber: 1, trainerId: getDailyChallenge(LAUNCH, data).trainer.id, variantId: getDailyChallenge(LAUNCH, data).variant.id, dataVersion: data.dataVersion, startedAt: new Date().toISOString(), battle: { seed: 'otra-pestana', ai: 'heuristic', leadIndex: 1 } })
    await startOfficial(user)
    expect(store().listDays()).toHaveLength(1)
    expect(clients[0].init.mock.calls[0][0]).toMatchObject({ battleSeed: 'otra-pestana', playerLead: 1 })
  })
})

describe('prácticas', () => {
  // Cambio de requisito (Jose, 31/10/2026; RF-84, UT-132): antes se podía practicar antes del oficial; ahora solo tras él.
  it('antes del oficial no se puede practicar; tras él, ilimitadas, con etiqueta PRÁCTICA, y no se guardan', async () => {
    const before = mountApp()
    await chooseLead(before.user)
    expect(practice()).toBeDisabled()
    before.unmount()
    officialDone()
    const saved = JSON.stringify(store().listDays())
    const first = mountApp()
    await chooseLead(first.user)
    await first.user.click(practice())
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'practice')
    expect(screen.getByTestId('battle-mode')).toHaveTextContent('PRÁCTICA')
    clients[0].emit(mkUpdate({ request: null, ended: WIN }))
    await settle()
    expect(JSON.stringify(store().listDays())).toBe(saved)
  })

  it('una práctica a medias no se reanuda al recargar', async () => {
    officialDone()
    const saved = JSON.stringify(store().listDays())
    const first = mountApp()
    await chooseLead(first.user)
    await first.user.click(practice())
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'practice')
    first.unmount()
    mountApp()
    expect(screen.queryByRole('button', { name: /reanudar/i })).toBeNull()
    expect(JSON.stringify(store().listDays())).toBe(saved)
  })

  it('después del oficial: se puede practicar y no cambia nada del oficial', async () => {
    const { user } = mountApp()
    await startOfficial(user)
    clients[0].emit(mkUpdate({ request: null, ended: WIN }))
    await settle()
    const before = JSON.stringify(store().listDays())
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    await chooseLead(user, 0)
    await user.click(practice())
    clients[1].emit(mkUpdate({ request: null, ended: { ...WIN, result: 'loss', playerAlive: 0, playerFainted: [true, true, true, true, true, true] } }))
    await settle()
    expect(JSON.stringify(store().listDays())).toBe(before)
  })

  it('«Otro combate» tras el oficial es una práctica', async () => {
    const { user } = mountApp()
    await startOfficial(user)
    clients[0].emit(mkUpdate({ request: null, ended: WIN }))
    await settle()
    await user.click(screen.getByRole('button', { name: /otro combate/i }))
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'practice')
  })
})

describe('el día es el del reto, no el de la hora de terminar', () => {
  it('un oficial terminado justo antes de medianoche cuenta para N; el resultado sigue en pantalla y Hoy muestra el reto nuevo', async () => {
    const { user } = mountApp(LAUNCH, 23, 59, 50)
    await startOfficial(user)
    clients[0].emit(mkUpdate({ request: null, ended: WIN }))
    await settle(20_000)
    expect(screen.getByRole('button', { name: /volver a hoy/i })).toBeInTheDocument()
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'won' })
    expect(store().getDay(addDays(LAUNCH, 1))).toBeNull()
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(screen.getByRole('banner')).toHaveTextContent('#2')
    expect(official()).toHaveTextContent(/jugar/i)
  })

  it('RF-80b: un oficial a medias a medianoche es derrota: sale del combate a Hoy, con el aviso, el reto nuevo y su oficial libre', async () => {
    const { user } = mountApp(LAUNCH, 23, 59, 50)
    await startOfficial(user)
    store().recordCheckpoint(LAUNCH, { decisions: 0, turn: 4, playerRemaining: 5, rivalRemaining: 3 })
    expect(screen.getByTestId('battle-screen')).toBeInTheDocument()
    await settle(20_000)
    expect(screen.queryByTestId('battle-screen')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Tu combate oficial del reto #1 se quedó sin terminar a medianoche: cuenta como derrota')
    expect(screen.getByRole('banner')).toHaveTextContent('#2')
    expect(official()).toHaveTextContent(/jugar/i)
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'lost', endReason: 'expired', turns: 4, survivors: 5, battle: null })
    expect(screen.queryByRole('button', { name: /reanudar/i })).toBeNull()
  })

  it('RF-80b: al abrir la web otro día con el oficial anterior a medias, ya es derrota y se avisa', async () => {
    const first = mountApp(LAUNCH, 20)
    await startOfficial(first.user)
    first.unmount()
    mountApp(addDays(LAUNCH, 2), 9)
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'lost', endReason: 'expired', turns: 0 })
    expect(screen.getByRole('alert')).toHaveTextContent(/reto #1 se quedó sin terminar/)
    expect(official()).toHaveTextContent(/jugar/i)
  })

  it('una práctica a medianoche sigue con su reto', async () => {
    officialDone()
    const { user } = mountApp(LAUNCH, 23, 59, 50)
    await chooseLead(user)
    await user.click(practice())
    await settle(20_000)
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'practice')
  })
})

describe('política cuando no se puede reanudar (DEC-43): el intento se gasta, sin victoria ni derrota', () => {
  async function savedOfficial(over: Record<string, unknown> = {}) {
    const challenge = getDailyChallenge(LAUNCH, data)
    store().startOfficial({ date: LAUNCH, challengeNumber: 1, trainerId: challenge.trainer.id, variantId: challenge.variant.id, dataVersion: data.dataVersion, startedAt: new Date().toISOString(), battle: { seed: 'seed-x', ai: 'heuristic', leadIndex: 0 }, ...over })
  }

  it('datos cambiados (otra versión de datos): mensaje en español, oficial anulado y no se puede repetir', async () => {
    await savedOfficial({ dataVersion: 'otra-version' })
    const { user } = mountApp()
    await user.click(official())
    expect(screen.getByRole('alert')).toHaveTextContent(/no se ha podido reanudar/i)
    expect(official()).toBeDisabled()
    expect(official()).toHaveTextContent(/anulado/i)
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'void', voidReason: 'dataChanged' })
    expect(clients).toHaveLength(0)
  })

  it('el rival guardado ya no existe en los datos', async () => {
    await savedOfficial({ trainerId: 'desaparecido' })
    const { user } = mountApp()
    await user.click(official())
    expect(store().getDay(LAUNCH)?.status).toBe('void')
  })

  it('la reproducción no llega al estado guardado: se anula y se avisa', async () => {
    await savedOfficial()
    const saved = store()
    saved.recordDecision(LAUNCH, { type: 'move', slot: 1 })
    saved.recordCheckpoint(LAUNCH, { decisions: 1, turn: 9, playerRemaining: 1, rivalRemaining: 1 })
    const { user } = mountApp()
    await user.click(official())
    lastClient().emit(mkUpdate())
    await settle(50)
    lastClient().emit(mkUpdate())
    await settle(50)
    expect(screen.getByRole('alert')).toHaveTextContent(/no se ha podido reanudar/i)
    expect(store().getDay(LAUNCH)).toMatchObject({ status: 'void', voidReason: 'replayFailed' })
    expect(official()).toBeDisabled()
  })

  it('el motor falla al reproducir: se anula igual', async () => {
    await savedOfficial()
    const { user } = mountApp()
    await user.click(official())
    lastClient().emit({ type: 'error', message: 'x' })
    await settle(50)
    expect(store().getDay(LAUNCH)?.status).toBe('void')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('sin almacenamiento', () => {
  it('el sitio funciona: el oficial se registra en memoria y se avisa de que no se guardará', async () => {
    setMadridTime(LAUNCH)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App data={data} store={new LocalStorageStore(null)} createClient={() => { const client = mockClient(); clients.push(client); return client as any }} />)
    expect(screen.getByText(/no deja guardar datos/i)).toBeInTheDocument()
    await chooseLead(user)
    await user.click(official())
    expect(screen.getByTestId('battle-screen')).toBeInTheDocument()
  })
})

describe('Ajustes (F3): velocidad guardada y borrar datos locales', () => {
  beforeEach(() => window.localStorage.clear())

  it('el combate empieza con la velocidad guardada y cambiarla en el combate se guarda', async () => {
    window.localStorage.setItem('daily-pwt:settings', JSON.stringify({ version: 1, speed: 4 }))
    officialDone()
    const { user } = mountApp()
    await chooseLead(user)
    await user.click(practice())
    expect(screen.getByRole('button', { name: /velocidad/i })).toHaveTextContent('x4')
    await user.click(screen.getByRole('button', { name: /velocidad/i }))
    expect(screen.getByRole('button', { name: /velocidad/i })).toHaveTextContent('x1')
    expect(JSON.parse(window.localStorage.getItem('daily-pwt:settings') as string)).toEqual({ version: 1, speed: 1, animations: 'always', sound: true, volume: 70 })
  })

  it('borrar datos locales devuelve el oficial del día y los ajustes por defecto', async () => {
    window.localStorage.setItem('daily-pwt:settings', JSON.stringify({ version: 1, speed: 2 }))
    const { user } = mountApp()
    await startOfficial(user)
    lastClient().emit(mkUpdate({ request: null, ended: WIN }))
    await settle()
    await user.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
    expect(official()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    await user.click(await screen.findByRole('button', { name: 'Borrar datos locales' }))
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    expect(store().listDays()).toEqual([])
    expect(window.localStorage.getItem('daily-pwt:settings')).toBeNull()
    expect(screen.getByRole('button', { name: 'x1' })).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{Escape}')
    expect(official()).toHaveTextContent('Jugar')
  })
})
