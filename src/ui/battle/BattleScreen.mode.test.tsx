import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleScreen } from './BattleScreen'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { settle } from '../../test-utils/ui'
import userEvent from '@testing-library/user-event'

// PRD §10.2: etiqueta visible OFICIAL / PRÁCTICA y textos propios de rendirse y salir en el oficial.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-17', data)

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

async function mount(mode?: 'official' | 'practice') {
  const client = mockClient()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<BattleScreen client={client as any} data={data} challenge={challenge} playerLead={0} battleSeed="seed-1" mode={mode} onFinish={vi.fn()} onExit={vi.fn()} />)
  client.emit(mkUpdate())
  await settle(8000)
  return { user }
}

describe('etiqueta de modo', () => {
  it('oficial: «OFICIAL»', async () => {
    await mount('official')
    expect(screen.getByTestId('battle-mode')).toHaveTextContent('OFICIAL')
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'official')
  })

  it('práctica: «PRÁCTICA», y es el modo por defecto', async () => {
    await mount()
    expect(screen.getByTestId('battle-mode')).toHaveTextContent('PRÁCTICA')
  })

  it('el oficial avisa al rendirse de que cuenta como derrota y no se repite hoy', async () => {
    const { user } = await mount('official')
    await user.click(screen.getByRole('button', { name: /rendirse/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/hoy no podrás repetirlo/i)
  })

  it('el oficial avisa al salir de que queda guardado para reanudar; la práctica, de que se descarta', async () => {
    const official = await mount('official')
    await official.user.click(screen.getByRole('button', { name: /^salir$/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/podrás reanudarlo desde Hoy/i)
  })

  it('en práctica, salir descarta la partida', async () => {
    const { user } = await mount('practice')
    await user.click(screen.getByRole('button', { name: /^salir$/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/descartará/i)
  })
})
