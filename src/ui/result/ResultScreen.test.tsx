import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResultScreen } from './ResultScreen'
import type { EngineEnd } from '../../battle/protocol'
import { LocalStorageStore } from '../../storage/localStorageStore'
import { MemoryStorage } from '../../test-utils/memoryStorage'
import { testMenu } from '../../test-utils/ui'

// CMP-23 · RF-60/61 · REQUISITOS §5. TODO-CONTRATO (src/ui/result/ResultScreen.tsx):
//   <ResultScreen ended={EngineEnd} onBackToToday={() => void} onRematch={() => void} />
//   EngineEnd = { result: 'win' | 'loss'; reason: 'faint' | 'forfeit' | 'turnLimit' | 'tie'; turns; playerAlive; rivalFainted }
//   Botones "Volver a Hoy" y "Otro combate". "Otro combate" repite el MISMO reto con un battleSeed nuevo (lo hace App, ver App.test.tsx).
type Ended = { result: 'win' | 'loss'; reason: string; turns: number; playerAlive: number; rivalFainted: number }
const win: Ended = { result: 'win', reason: 'faint', turns: 23, playerAlive: 2, rivalFainted: 6 }
const loss: Ended = { result: 'loss', reason: 'faint', turns: 17, playerAlive: 0, rivalFainted: 4 }

function show(ended: Ended) {
  const onBackToToday = vi.fn()
  const onRematch = vi.fn()
  const user = userEvent.setup()
  render(<ResultScreen ended={ended as any} onBackToToday={onBackToToday} onRematch={onRematch} />)
  return { onBackToToday, onRematch, user }
}

describe('ResultScreen', () => {
  it('victoria: muestra "Victoria"', () => {
    show(win)
    expect(screen.getByRole('heading')).toHaveTextContent(/victoria/i)
  })

  it('victoria: muestra los turnos', () => {
    show(win)
    expect(document.body).toHaveTextContent(/turnos?.*23|23.*turnos?/i)
  })

  it('victoria: muestra cuántos Pokémon del jugador quedan en pie', () => {
    show(win)
    expect(document.body).toHaveTextContent(/(en pie|quedan|supervivientes).*2|2.*(en pie|quedan|supervivientes)/i)
  })

  it('derrota: muestra "Derrota"', () => {
    show(loss)
    expect(screen.getByRole('heading')).toHaveTextContent(/derrota/i)
  })

  it('derrota: muestra los rivales debilitados como x/6', () => {
    show(loss)
    expect(document.body).toHaveTextContent(/4\s*\/\s*6/)
  })

  it('victoria: no muestra rivales debilitados x/6 como derrota', () => {
    show(win)
    expect(screen.getByRole('heading')).not.toHaveTextContent(/derrota/i)
  })

  it('rendición: derrota que indica la rendición', () => {
    show({ ...loss, reason: 'forfeit', turns: 3, rivalFainted: 0 })
    expect(screen.getByRole('heading')).toHaveTextContent(/derrota/i)
    expect(document.body).toHaveTextContent(/rend/i)
  })

  it('límite de 300 turnos: derrota que menciona el límite', () => {
    show({ ...loss, reason: 'turnLimit', turns: 301, rivalFainted: 2, playerAlive: 3 })
    expect(screen.getByRole('heading')).toHaveTextContent(/derrota/i)
    expect(document.body).toHaveTextContent(/300/)
  })

  it('empate: cuenta como derrota', () => {
    show({ ...loss, reason: 'tie', rivalFainted: 6 })
    expect(screen.getByRole('heading')).toHaveTextContent(/derrota/i)
  })

  it('"Volver a Hoy" llama a onBackToToday', async () => {
    const { user, onBackToToday } = show(win)
    await user.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(onBackToToday).toHaveBeenCalledTimes(1)
  })

  it('"Otro combate" llama a onRematch', async () => {
    const { user, onRematch } = show(win)
    await user.click(screen.getByRole('button', { name: /otro combate/i }))
    expect(onRematch).toHaveBeenCalledTimes(1)
  })

  it('no hay ids internos ni inglés en la pantalla (turnLimit/forfeit/faint)', () => {
    show({ ...loss, reason: 'turnLimit', turns: 301 })
    expect(document.body.textContent).not.toMatch(/turnLimit|forfeit|faint|loss|win\b/)
  })
})

describe('ResultScreen con historial (F3: estadísticas y compartir)', () => {
  const finishOfficial = (ended: EngineEnd) => {
    const store = new LocalStorageStore(new MemoryStorage())
    store.startOfficial({ date: '2026-10-22', challengeNumber: 4, trainerId: 'misty', variantId: 'misty-1', dataVersion: 'v1', startedAt: 'x', battle: { seed: 's', ai: 'trivial', leadIndex: 0 } })
    store.finishOfficial('2026-10-22', ended, 'y')
    return store
  }
  const official: EngineEnd = { result: 'win', reason: 'faint', turns: 23, playerAlive: 4, rivalFainted: 6, playerFainted: [false, true, false, false, true, false] }

  it('oficial: estadísticas actualizadas y botón Copiar que copia el texto sin spoilers', async () => {
    const store = finishOfficial(official)
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ResultScreen ended={official} mode="official" store={store} date="2026-10-22" menu={testMenu(store)} onBackToToday={vi.fn()} onRematch={vi.fn()} />)
    expect(screen.getByTestId('stats-played')).toHaveTextContent('1')
    expect(screen.getByTestId('stats-win-streak')).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Daily PWT #4\n✅ Victoria en 23 turnos\n🟩🟥🟩🟩🟥🟩\n🔥 Racha: 1'))
    expect(await screen.findByRole('status')).toHaveTextContent(/copiado/i)
  })

  it('práctica: sin estadísticas en el panel ni Copiar, pero con el acceso a Estadísticas', async () => {
    const store = finishOfficial(official)
    const user = userEvent.setup()
    render(<ResultScreen ended={official} mode="practice" store={store} date="2026-10-22" menu={testMenu(store)} onBackToToday={vi.fn()} onRematch={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    expect(screen.getByRole('dialog', { name: 'Estadísticas' })).toBeInTheDocument()
    expect(screen.getByTestId('stats-played')).toHaveTextContent('1')
  })

  it('el modal se cierra con Escape y con «Cerrar»', async () => {
    const store = finishOfficial(official)
    const user = userEvent.setup()
    render(<ResultScreen ended={official} mode="practice" store={store} date="2026-10-22" menu={testMenu(store)} onBackToToday={vi.fn()} onRematch={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
