import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { UnovaExchangeScreen } from './UnovaExchangeScreen'
import { n2b2Ui } from './unovaRoute'

// UT-228 · Tienda de Teselia (maqueta del 14/11/2026): la pantalla de tienda de la ROM con PB, lo que tienes del señalado, la lista con
// precios y la descripción; arriba, el objeto con su precio y los PB que quedarían, y lo que lleva el equipo. Canjear pide confirmación.
const names: Record<string, string> = { leftovers: 'Restos', scopelens: 'Periscopio', choiceband: 'Cinta Elección' }
const offers = [{ item: 'scopelens', price: 8 }, { item: 'choiceband', price: 24 }]

function mount(points: number) {
  const onBuy = vi.fn()
  const onExit = vi.fn()
  const result = render(<UnovaExchangeScreen points={points} offers={offers} onBuy={onBuy} onExit={onExit} itemName={(id) => names[id] ?? id}
    itemText={() => 'Descripción del objeto.'} owned={(id) => (id === 'scopelens' ? 2 : 0)}
    team={[{ species: 'patrat', name: 'Patrat', item: 'leftovers' }, { species: 'pidove', name: 'Pidove', item: null }]} scale={2} />)
  return { ...result, onBuy, onExit }
}

describe('Tienda de Teselia', () => {
  it('canjear pide confirmación y SÍ lo compra', () => {
    const { onBuy } = mount(10)
    fireEvent.click(screen.getByRole('button', { name: 'Periscopio, 8 PB' }))
    expect(screen.getByRole('status')).toHaveTextContent('¿Canjear Periscopio por 8 PB?')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sí, canjear' }))
    expect(onBuy).toHaveBeenCalledWith('scopelens')
    expect(screen.getByRole('status')).toHaveTextContent('¡Has obtenido Periscopio! Está en la MOCHILA.')
  })

  it('sin PB suficientes avisa y no pregunta; arriba, lo que quedaría o lo que falta', () => {
    const { onBuy } = mount(10)
    expect(screen.getByText('Te quedarían 2 PB')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cinta Elección, 24 PB, no te alcanza' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No tienes suficientes Puntos Batalla.')
    expect(screen.getByText('Te faltan 14 PB')).toBeInTheDocument()
    expect(onBuy).not.toHaveBeenCalled()
  })

  it('enseña la pantalla de tienda, lo que ya tienes del señalado y lo que lleva el equipo; SALIR vuelve', () => {
    const { container, onExit } = mount(10)
    expect(container.querySelector(`img[src="${n2b2Ui('tienda-fondo')}"]`)).not.toBeNull()
    expect(screen.getByText('Restos')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salir del canje y volver a la ruta' }))
    expect(onExit).toHaveBeenCalled()
  })
})
