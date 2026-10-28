import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getDailyChallenge } from '../../core/challenge'
import type { ReplayData, ReplayStep } from '../../replay/replayData'
import { DEFAULT_SETTINGS } from '../../storage/settings'
import { makeGameData } from '../../test-utils/fixtures'
import { settle } from '../../test-utils/ui'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { ReplayViewer } from './ReplayViewer'

// UT-107 · F5 (RF-127 a RF-130): visor de repeticiones sobre la pantalla de combate, sin menús y con sus controles.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-29', data)
const SIX = ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic']
const RSIX = ['snorlax', 'tyranitar', 'heatran', 'lapras', 'starmie', 'gyarados']
const view = (turn: number, rivalHp = 100) => mkView({ turn, player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s, i) => (i === 0 ? rMon(s, rivalHp) : rMon(s))) }) as ReplayStep['view']
const ENDED = { result: 'win' as const, reason: 'faint' as const, turns: 3, playerAlive: 6, rivalFainted: 6, playerFainted: [false, false, false, false, false, false] }
const replay: ReplayData = {
  version: 1,
  challenge,
  playerLead: 0,
  battleSeed: 'seed-1',
  ai: 'heuristic',
  steps: [
    { lines: [], view: view(1) },
    // El turno 1 con un movimiento y su daño: mensajes y barra de PS que tardan en reproducirse, como en un combate de verdad.
    { lines: ['|move|p1a: Garchomp|Earthquake|p2a: Snorlax', '|-damage|p2a: Snorlax|70/100', '|turn|2'], view: view(2, 70) },
    { lines: ['|turn|3'], view: view(3, 40) },
    { lines: ['|win|Jugador'], view: view(3, 0), ended: ENDED },
  ],
  ended: ENDED,
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

async function mount(onDelete?: () => void) {
  const onExit = vi.fn()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<ReplayViewer replay={replay} data={data} settings={DEFAULT_SETTINGS} onExit={onExit} onDelete={onDelete} />)
  await settle()
  const controls = () => screen.getByRole('group', { name: 'Controles de la repetición' })
  return { user, onExit, controls }
}

describe('visor de repeticiones (UT-107)', () => {
  it('sin menú de combate ni rendirse; etiqueta REPETICIÓN y «Volver» sale sin confirmar', async () => {
    const { user, onExit } = await mount()
    expect(screen.getByTestId('battle-mode')).toHaveAttribute('data-mode', 'replay')
    expect(screen.queryByRole('button', { name: /^luchar$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /rendirse/i })).toBeNull()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Volver' })[0])
    expect(onExit).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('turno siguiente, turno anterior, al final (con el resultado) y al principio', async () => {
    const { user, controls } = await mount()
    expect(within(controls()).getByRole('button', { name: 'Al principio' })).toBeDisabled()
    // El rótulo dice el turno que se está viendo (RF-128): «Inicio» antes del primero.
    await user.click(within(controls()).getByRole('button', { name: 'Turno siguiente' }))
    await settle()
    expect(screen.getByText('Turno 1 de 3')).toBeInTheDocument()
    await user.click(within(controls()).getByRole('button', { name: 'Turno siguiente' }))
    await settle()
    expect(screen.getByText('Turno 2 de 3')).toBeInTheDocument()
    await user.click(within(controls()).getByRole('button', { name: 'Turno anterior' }))
    await settle()
    expect(screen.getByText('Turno 1 de 3')).toBeInTheDocument()
    await user.click(within(controls()).getByRole('button', { name: 'Al final' }))
    await settle()
    expect(screen.getByText(/^Victoria · 3 turnos · 6\/6 en pie$/)).toBeInTheDocument()
    expect(within(controls()).getByRole('button', { name: 'Turno siguiente' })).toBeDisabled()
    expect(within(controls()).getByRole('button', { name: 'Reproducir' })).toBeDisabled()
    await user.click(within(controls()).getByRole('button', { name: 'Al principio' }))
    await settle()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })

  it('«Turno siguiente» es directo: salta al turno siguiente sin esperar a sus animaciones (RF-128)', async () => {
    const { user, controls } = await mount()
    await user.click(within(controls()).getByRole('button', { name: 'Turno siguiente' }))
    await settle(50)
    expect(screen.getByText('Turno 1 de 3')).toBeInTheDocument()
    expect(within(controls()).getByRole('button', { name: 'Turno siguiente' })).toBeEnabled()
    await user.click(within(controls()).getByRole('button', { name: 'Turno siguiente' }))
    await settle(50)
    expect(screen.getByText('Turno 2 de 3')).toBeInTheDocument()
  })

  it('con «Reproducir», «Turno siguiente» termina al instante el turno que se está enseñando', async () => {
    const { user, controls } = await mount()
    await user.click(within(controls()).getByRole('button', { name: 'Reproducir' }))
    // Tras la pausa entre turnos empieza a enseñarse el turno 1, con su movimiento y su daño.
    await settle(800)
    expect(screen.getByText('Turno 1 de 3')).toBeInTheDocument()
    await user.click(within(controls()).getByRole('button', { name: 'Turno siguiente' }))
    await settle(50)
    expect(screen.getByText('Turno 1 de 3')).toBeInTheDocument()
    expect(within(controls()).getByRole('button', { name: 'Turno siguiente' })).toBeEnabled()
  })


  it('reproducir avanza solo hasta el final; pausa lo para', async () => {
    const { user, controls } = await mount()
    await user.click(within(controls()).getByRole('button', { name: 'Reproducir' }))
    expect(within(controls()).getByRole('button', { name: 'Pausa' })).toBeInTheDocument()
    await settle(2_000)
    await user.click(within(controls()).getByRole('button', { name: 'Pausa' }))
    const turnAfterPause = screen.getByText(/^Turno \d de 3$/).textContent
    await settle(10_000)
    expect(screen.getByText(/^Turno \d de 3$/).textContent).toBe(turnAfterPause)
    await user.click(within(controls()).getByRole('button', { name: 'Reproducir' }))
    // De segundo en segundo: cada turno programa el siguiente al terminar (un solo avance largo no los deja encadenarse).
    for (let second = 0; second < 15; second++) await settle(1_000)
    expect(screen.getByText(/^Victoria/)).toBeInTheDocument()
    expect(within(controls()).getByRole('button', { name: 'Reproducir' })).toBeDisabled()
  })

  it('«Borrar enlace» solo si se le pasa (quien la compartió)', async () => {
    const onDelete = vi.fn()
    const { user } = await mount(onDelete)
    await user.click(screen.getByRole('button', { name: 'Borrar enlace' }))
    expect(onDelete).toHaveBeenCalled()
  })
})
