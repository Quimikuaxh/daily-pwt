import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadGameData } from '../../data/gameData'
import { continueTowerRun, finishTowerRound, newTowerRun, startTowerRound, towerRemaining, towerTrainerTotal, type TowerRun } from '../../core/battle-tower/tower'
import { mockCampaignCanvas } from '../../test-utils/campaignUi'
import { TowerVictory } from './TowerVictory'

mockCampaignCanvas()
const data = loadGameData()
const run = { ...newTowerRun('victoria', data), phase: 'won' as const, index: 6 }

// UT-248 (Jose, 17/11/2026, maqueta A): la victoria de la Torre enseña los siete vencidos en orden, el campeón el último, y el equipo.
describe('victoria de la Torre (UT-248)', () => {
  it('nombra a los siete vencidos en orden y al equipo, y pinta a todos en el escenario', () => {
    const { container } = render(<TowerVictory data={data} run={run} title="Torre Batalla" beaten={7} total={53} onNewSeries={() => undefined} onExit={() => undefined} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¡Serie 1 superada! 7 de 53 vencidos')
    const [beaten, team] = screen.getAllByRole('list')
    const rivals = run.rivals.map((rival) => rival.trainer.nameEs)
    expect([...beaten.querySelectorAll('li')].map((li) => li.textContent)).toEqual([...rivals.slice(0, 6), `${rivals[6]}, campeón`])
    expect([...team.querySelectorAll('li')].map((li) => li.textContent)).toEqual(run.team.map((member) => `${member.nameEs}, nivel ${member.level}`))
    expect(container.querySelectorAll('.unova-hall img[src*="-vs.png"]')).toHaveLength(7)
    expect(container.querySelectorAll('.unova-screen .bt-member-icon')).toHaveLength(6)
  })

  // UT-249 (Jose, 17/11/2026): con rivales por delante, «Seguir con este equipo» va primero; sin ellos, no sale.
  it('ofrece seguir con el equipo solo si quedan rivales', async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<TowerVictory data={data} run={run} title="Torre Batalla" beaten={7} total={53} onContinue={onContinue} onNewSeries={() => undefined} onExit={() => undefined} />)
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Seguir con este equipo', 'Nueva serie', 'Volver a Hoy'])
    await user.click(screen.getByRole('button', { name: 'Seguir con este equipo' }))
    expect(onContinue).toHaveBeenCalledOnce()
    rerender(<TowerVictory data={data} run={run} title="Torre Batalla" beaten={53} total={53} onNewSeries={() => undefined} onExit={() => undefined} />)
    expect(screen.queryByRole('button', { name: 'Seguir con este equipo' })).toBeNull()
  })

  it('Nueva serie y Volver a Hoy; Nueva serie se bloquea mientras guarda', async () => {
    const onNewSeries = vi.fn()
    const onExit = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<TowerVictory data={data} run={run} title="Torre Batalla" beaten={7} total={53} onNewSeries={onNewSeries} onExit={onExit} />)
    await user.click(screen.getByRole('button', { name: 'Nueva serie' }))
    await user.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
    expect([onNewSeries, onExit].map((fn) => fn.mock.calls.length)).toEqual([1, 1])
    rerender(<TowerVictory data={data} run={run} title="Torre Batalla" beaten={7} total={53} busy onNewSeries={onNewSeries} onExit={onExit} />)
    expect(screen.getByRole('button', { name: 'Nueva serie' })).toBeDisabled()
  })

  // UT-250 (Jose, 17/11/2026, maqueta A de la victoria final): con los 53 vencidos, la banda de la Torre completada, los 53 en el orden en
  // que cayeron y sin «Seguir».
  it('al completar los 53 enseña la victoria final con todos los vencidos en orden', () => {
    let current: TowerRun = newTowerRun('racha-completa', data)
    for (;;) {
      for (let i = 0; i < current.rivals.length; i += 1) current = finishTowerRound(startTowerRound(current), 'win')
      if (towerRemaining(current, data) === 0) break
      current = continueTowerRun(current, data)
    }
    const total = towerTrainerTotal(data)
    const { container } = render(<TowerVictory data={data} run={current} title="Torre Batalla" beaten={total} total={total} onNewSeries={() => undefined} onExit={() => undefined} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¡Torre Batalla completada! 53 de 53 vencidos')
    const order = [...current.beaten!, ...current.rivals.map(({ trainer }) => trainer.id)]
    const names = order.map((id) => data.trainers.find((trainer) => trainer.id === id)!)
    expect([...screen.getAllByRole('list')[0].querySelectorAll('li')].map((li) => li.textContent))
      .toEqual(names.map((trainer) => trainer.category === 'champion' ? `${trainer.nameEs}, campeón` : trainer.nameEs))
    expect(container.querySelectorAll('.unova-hall img[src*="-mini.png"]')).toHaveLength(53)
    expect(screen.queryByRole('button', { name: 'Seguir con este equipo' })).toBeNull()
  })
})
