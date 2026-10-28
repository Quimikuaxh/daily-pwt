import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayScreen } from './TodayScreen'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { setMadridTime, testMenu } from '../../test-utils/ui'
import { LAUNCH } from '../../test-utils/dates'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { LocalStorageStore } from '../../storage/localStorageStore'
import type { EngineEnd } from '../../battle/protocol'

// DEC-43 · PRD §10.1: «Combate oficial» (Jugar / Reanudar / resultado) y «Práctica».
const data = makeGameData()
const challenge = getDailyChallenge(LAUNCH, data)
const WIN: EngineEnd = { result: 'win', reason: 'faint', turns: 23, playerAlive: 4, rivalFainted: 6, playerFainted: [false, true, false, false, true, false] }
const LOSS: EngineEnd = { result: 'loss', reason: 'forfeit', turns: 5, playerAlive: 6, rivalFainted: 0, playerFainted: [false, false, false, false, false, false] }

beforeEach(() => {
  vi.useFakeTimers()
  setMadridTime(LAUNCH)
})
afterEach(() => { vi.useRealTimers() })

function savedStore(date = LAUNCH) {
  const store = new LocalStorageStore(new MemoryStorage())
  store.startOfficial({ date, challengeNumber: 1, trainerId: challenge.trainer.id, variantId: challenge.variant.id, dataVersion: data.dataVersion, startedAt: new Date().toISOString(), battle: { seed: 's', ai: 'heuristic', leadIndex: 0 } })
  return store
}

function mount(store?: LocalStorageStore, over: { onStart?: any; onResume?: any; notice?: string } = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onStart = over.onStart ?? vi.fn()
  const onResume = over.onResume ?? vi.fn()
  render(<TodayScreen data={data} store={store} menu={store ? testMenu(store) : undefined} onStart={onStart} onResume={onResume} notice={over.notice} />)
  return { user, onStart, onResume }
}
const official = () => screen.getByRole('button', { name: /^combate oficial/i })
const practice = () => screen.getByRole('button', { name: /^pr[aá]ctica$/i })
const pickLead = (user: ReturnType<typeof userEvent.setup>, index = 0) => user.click(screen.getAllByRole('button', { name: /primero/i })[index])

describe('botón de combate oficial: estados', () => {
  it('no jugado: «Jugar», deshabilitado hasta elegir inicial y luego inicia el oficial', async () => {
    const { user, onStart } = mount(new LocalStorageStore(new MemoryStorage()))
    expect(official()).toHaveTextContent('Jugar')
    expect(official()).toBeDisabled()
    await pickLead(user, 3)
    expect(official()).toBeEnabled()
    await user.click(official())
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ date: LAUNCH }), 3, 'official')
  })

  it('en curso: «Reanudar», habilitado sin elegir inicial, y reanuda el registro de hoy', async () => {
    const store = savedStore()
    const { user, onResume, onStart } = mount(store)
    expect(official()).toHaveTextContent('Reanudar')
    expect(official()).toBeEnabled()
    await user.click(official())
    expect(onResume).toHaveBeenCalledWith(expect.objectContaining({ date: LAUNCH, status: 'inProgress' }))
    expect(onStart).not.toHaveBeenCalled()
  })

  it('ganado: deshabilitado y con el resultado (victoria, turnos y supervivientes)', async () => {
    const store = savedStore()
    store.finishOfficial(LAUNCH, WIN, new Date().toISOString())
    const { user, onStart } = mount(store)
    expect(official()).toBeDisabled()
    expect(official()).toHaveTextContent('Victoria · 23 turnos · 4/6 en pie')
    await pickLead(user)
    await user.click(official())
    expect(onStart).not.toHaveBeenCalled()
  })

  it('perdido: deshabilitado y con la derrota', () => {
    const store = savedStore()
    store.finishOfficial(LAUNCH, LOSS, new Date().toISOString())
    mount(store)
    expect(official()).toBeDisabled()
    expect(official()).toHaveTextContent('Derrota · 5 turnos · 6/6 en pie')
  })

  it('un solo turno va en singular', () => {
    const store = savedStore()
    store.finishOfficial(LAUNCH, { ...LOSS, turns: 1 }, new Date().toISOString())
    mount(store)
    expect(official()).toHaveTextContent('Derrota · 1 turno · 6/6 en pie')
  })

  it('anulado (no se pudo reanudar): deshabilitado y lo dice', () => {
    const store = savedStore()
    store.voidOfficial(LAUNCH, 'replayFailed', new Date().toISOString())
    mount(store)
    expect(official()).toBeDisabled()
    expect(official()).toHaveTextContent(/anulado/i)
  })

  it('el estado de un día no afecta a otro: el oficial de ayer terminado deja el de hoy libre', () => {
    const store = savedStore('2026-10-18')
    store.finishOfficial('2026-10-18', WIN, new Date().toISOString())
    mount(store)
    expect(official()).toHaveTextContent('Jugar')
  })
})

describe('botón de práctica', () => {
  it('con el oficial terminado sigue disponible (con inicial) y lanza una práctica', async () => {
    const store = savedStore()
    store.finishOfficial(LAUNCH, WIN, new Date().toISOString())
    const { user, onStart } = mount(store)
    expect(practice()).toBeDisabled()
    await pickLead(user, 1)
    await user.click(practice())
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ date: LAUNCH }), 1, 'practice')
  })

  it('con el oficial en curso también se puede practicar', async () => {
    const { user, onStart } = mount(savedStore())
    await pickLead(user)
    await user.click(practice())
    expect(onStart).toHaveBeenCalledWith(expect.anything(), 0, 'practice')
  })
})

describe('avisos', () => {
  it('RF-80b: un oficial sin terminar de un día anterior no se ofrece reanudar (a medianoche es derrota, App lo cierra)', () => {
    mount(savedStore('2026-10-18'))
    expect(screen.queryByRole('button', { name: /reanudar/i })).toBeNull()
    expect(official()).toHaveTextContent('Jugar')
  })

  it('enseña el aviso que deja la pantalla anterior', () => {
    mount(new LocalStorageStore(new MemoryStorage()), { notice: 'No se ha podido reanudar' })
    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido reanudar')
  })

  it('sin almacenamiento avisa de que no se guardará, y con él no', () => {
    mount(new LocalStorageStore(null))
    expect(screen.getByText(/no deja guardar datos/i)).toBeInTheDocument()
  })

  it('con almacenamiento no hay aviso', () => {
    mount(new LocalStorageStore(new MemoryStorage()))
    expect(screen.queryByText(/no deja guardar datos/i)).toBeNull()
  })
})

describe('Estadísticas desde Hoy (F3)', () => {
  it('el botón de la cabecera abre Estadísticas con el historial y, si el oficial de hoy terminó, Copiar', async () => {
    const store = savedStore()
    store.finishOfficial(LAUNCH, WIN, new Date().toISOString())
    const { user } = mount(store)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    const dialog = await screen.findByRole('dialog', { name: 'Estadísticas' })
    expect(dialog).toHaveTextContent(/Jugados\s*1/)
    expect(screen.getByTestId('stats-win-percent')).toHaveTextContent('100')
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument()
  })

  it('sin oficiales terminados: mensaje de vacío y sin Copiar', async () => {
    const { user } = mount(new LocalStorageStore(new MemoryStorage()))
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Aún no has terminado ningún combate oficial/)
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()
  })
})
