import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResultScreen } from './ResultScreen'

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
