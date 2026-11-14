import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { loadGameData } from '../../data/gameData'
import { UnovaEvolutionScene } from './UnovaEvolutionScene'

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
  })
})
