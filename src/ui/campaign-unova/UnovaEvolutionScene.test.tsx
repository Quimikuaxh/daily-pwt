import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { loadGameData } from '../../data/gameData'
import { UnovaEvolutionScene } from './UnovaEvolutionScene'

const audio = vi.hoisted(() => ({
  register: vi.fn(), preload: vi.fn(), playMusic: vi.fn(), stopMusic: vi.fn(), playCry: vi.fn(), playSfx: vi.fn(),
}))
vi.mock('../../audio/audio', async (original) => ({
  ...await original<typeof import('../../audio/audio')>(), getAudio: () => audio,
}))
beforeEach(() => vi.clearAllMocks())

// UT-230 · Evolución de Teselia (maqueta del 14/11/2026): mensaje en la franja del combate del diario, CONTINUAR en el botón grande de
// la pantalla táctil y, con varias formas, los botones de movimiento del combate para elegir. Con movimiento reducido no se anima.
const data = loadGameData()
vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }))

describe('Evolución de Teselia', () => {
  it('anuncia, deja elegir forma con los botones del combate y devuelve la elegida', () => {
    const onDone = vi.fn()
    render(<UnovaEvolutionScene data={data} nameOf={(id) => id} hpOf={() => 50} onDone={onDone} scale={2}
      evolutions={[{ id: 'a', species: 'eevee', targets: ['vaporeon', 'jolteon'], level: 30 }]} />)
    expect(screen.getByRole('status')).toHaveTextContent('¿Qué? ¡eevee está evolucionando!')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Evolucionar en jolteon' }))
    expect(screen.getByRole('status')).toHaveTextContent('¡Enhorabuena! ¡Tu eevee ha evolucionado en jolteon!')
    fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }))
    expect(onDone).toHaveBeenCalledWith({ a: 'jolteon' })
    expect(audio.playMusic).toHaveBeenCalledWith('unova-evolution')
    expect(audio.playMusic).toHaveBeenCalledWith('unova-evolved')
    expect(audio.preload).toHaveBeenCalledWith(['unova-evolution'], [])
    expect(audio.preload).toHaveBeenCalledWith([], [], ['eevee', 'vaporeon', 'jolteon'])
    expect(audio.playCry).toHaveBeenCalledWith('jolteon', { faint: false })
    expect(audio.playSfx).not.toHaveBeenCalled()
    expect(JSON.stringify([audio.preload.mock.calls, audio.playMusic.mock.calls, audio.playCry.mock.calls])).not.toContain('emerald-')
  })
})
