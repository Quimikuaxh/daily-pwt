import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBattleEngine } from '../battle/engine'
import { createWorkerClient, type WorkerLike } from '../battle/client'
import type { ReplayData } from './replayData'
import { BattleScreen } from '../ui/battle/BattleScreen'
import { ReplayViewer } from '../ui/replay/ReplayViewer'
import { realChallenge, realData } from '../ui/battle/party/partyFixtures'
import { filler } from '../test-utils/teams'
import { settle } from '../test-utils/ui'
import { DEFAULT_SETTINGS } from '../storage/settings'
import { INTRO_DURATIONS_MS } from '../hooks/useBattle'
import SummaryScreen from '../ui/battle/party/SummaryScreen'

// Importar la ficha evita que la carga lazy dependa de la carga de la tanda.
void SummaryScreen
const INTRO_TOTAL_MS = Object.values(INTRO_DURATIONS_MS).reduce((sum, ms) => sum + ms, 0)
const player = [filler('ditto'), filler('ditto')]
const rival = [filler('geodude'), filler('geodude')]
const initial = createBattleEngine({ battleSeed: 'visible-identities', player, rival, ai: 'trivial', maxTurns: 30 }).start()
const steps = [initial, { ...initial, view: { ...initial.view, turn: 2 }, lines: [
  '|move|p1a: ditto__0|Transform|p2a: geodude__1',
  '|-transform|p1a: ditto__0|p2a: geodude__1', '|turn|2',
] }]
const replay: ReplayData = { version: 1, challenge: { ...realChallenge, playerTeam: player, rivalTeam: rival },
  battleSeed: 'visible-identities', playerLead: 0, ai: 'trivial',
  steps: steps.map(({ lines, view }) => ({ lines, view })), ended: null }

function expectCleanText() {
  expect(document.body.textContent).not.toMatch(/__\d+|member\d+/)
  for (const element of document.querySelectorAll('[aria-label], [alt], [title]')) {
    for (const attr of ['aria-label', 'alt', 'title']) expect(element.getAttribute(attr) ?? '').not.toMatch(/__\d+|member\d+/)
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('identidades fuera de la presentación', () => {
  it.each(['combate', 'repetición pública'] as const)('mensajes, registro, equipo y ficha sin sufijos en %s', async mode => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const worker: WorkerLike = { onmessage: null, onerror: null, onmessageerror: null, terminate() {},
      postMessage() { this.onmessage?.({ data: { type: 'update', ...initial } } as MessageEvent) } }
    const client = createWorkerClient(() => worker)
    if (mode === 'combate') {
      render(<BattleScreen client={client} data={realData} challenge={replay.challenge} playerLead={0}
        battleSeed={replay.battleSeed} onFinish={vi.fn()} onExit={vi.fn()} />)
      await settle(8000)
      act(() => worker.onmessage?.({ data: { type: 'update', ...steps[1] } } as MessageEvent))
    } else {
      render(<ReplayViewer replay={replay} data={realData} settings={DEFAULT_SETTINGS} own={false}
        onSoundChange={vi.fn()} onExit={vi.fn()} />)
      // Espera a que acabe la intro (con la pancarta VS, RF-137, dura 6,9 s a x1) antes de pedir el turno siguiente.
      await settle(INTRO_TOTAL_MS + 4000)
      await user.click(screen.getByRole('button', { name: 'Turno siguiente' }))
    }
    await settle(30000)
    expectCleanText()
    await user.click(screen.getByRole('button', { name: /registro/i }))
    const log = screen.getByRole('log')
    expect(log.textContent).toContain('transformado en Geodude')
    expectCleanText()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.click(screen.getByRole('button', { name: mode === 'combate' ? /^Cambiar$/ : /^Equipo$/ }))
    await settle(100)
    const team = screen.getByRole('region', { name: 'Equipo' })
    expectCleanText()
    const panel = within(team).getAllByRole('button').find(button => button.classList.contains('bt-party-panel'))!
    await user.click(panel)
    await user.click(screen.getByRole('button', { name: 'Datos' }))
    await settle(100)
    expect(screen.getByRole('region', { name: /^Datos de Ditto/ })).toBeInTheDocument()
    expectCleanText()
    for (let page = 0; page < 2; page++) {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expectCleanText()
    }
  })
})
