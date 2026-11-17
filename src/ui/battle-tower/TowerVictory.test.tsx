import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadGameData } from '../../data/gameData'
import { newTowerRun } from '../../core/battle-tower/tower'
import { mockCampaignCanvas } from '../../test-utils/campaignUi'
import { TowerVictory } from './TowerVictory'

mockCampaignCanvas()
const data = loadGameData()
const run = { ...newTowerRun('victoria', data), phase: 'won' as const, index: 6 }

// UT-248 (Jose, 17/11/2026, maqueta A): la victoria de la Torre enseña los siete vencidos en orden, el campeón el último, y el equipo.
describe('victoria de la Torre (UT-248)', () => {
  it('nombra a los siete vencidos en orden y al equipo, y pinta a todos en el escenario', () => {
    const { container } = render(<TowerVictory data={data} run={run} title="Torre Batalla" onNewSeries={() => undefined} onExit={() => undefined} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Torre completada. 7 de 7 victorias')
    const [beaten, team] = screen.getAllByRole('list')
    const rivals = run.rivals.map((rival) => rival.trainer.nameEs)
    expect([...beaten.querySelectorAll('li')].map((li) => li.textContent)).toEqual([...rivals.slice(0, 6), `${rivals[6]}, campeón`])
    expect([...team.querySelectorAll('li')].map((li) => li.textContent)).toEqual(run.team.map((member) => `${member.nameEs}, nivel ${member.level}`))
    expect(container.querySelectorAll('.unova-hall img[src*="-vs.png"]')).toHaveLength(7)
    expect(container.querySelectorAll('.unova-screen .bt-member-icon')).toHaveLength(6)
  })

  it('Nueva serie y Volver a Hoy; Nueva serie se bloquea mientras guarda', async () => {
    const onNewSeries = vi.fn()
    const onExit = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<TowerVictory data={data} run={run} title="Torre Batalla" onNewSeries={onNewSeries} onExit={onExit} />)
    await user.click(screen.getByRole('button', { name: 'Nueva serie' }))
    await user.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
    expect([onNewSeries, onExit].map((fn) => fn.mock.calls.length)).toEqual([1, 1])
    rerender(<TowerVictory data={data} run={run} title="Torre Batalla" busy onNewSeries={onNewSeries} onExit={onExit} />)
    expect(screen.getByRole('button', { name: 'Nueva serie' })).toBeDisabled()
  })
})
