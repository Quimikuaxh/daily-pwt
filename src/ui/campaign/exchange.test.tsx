import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { exchangeScroll, EXCHANGE_ROWS } from './exchangeModel'
import { ExchangeScreen } from './ExchangeScreen'

// UT-187 · Canje de Puntos Batalla (D7): lista de 6 filas que se desplaza, confirmación, compra y PB insuficientes.
const offers = [{ item: 'leftovers', price: 48 }, { item: 'whiteherb', price: 48 }, { item: 'quickclaw', price: 48 }, { item: 'mentalherb', price: 48 },
  { item: 'brightpowder', price: 64 }, { item: 'choiceband', price: 64 }, { item: 'kingsrock', price: 64 }]

describe('canje de Puntos Batalla', () => {
  beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
  afterEach(() => { vi.restoreAllMocks() })

  it('la lista enseña 6 filas y se desplaza para que el cursor se vea', () => {
    expect(EXCHANGE_ROWS).toBe(6)
    expect(exchangeScroll(6, 0, 8)).toBe(1)
    expect(exchangeScroll(0, 2, 8)).toBe(0)
  })

  it('pide confirmación y compra; sin PB suficientes lo dice y no compra', () => {
    const onBuy = vi.fn()
    const { unmount } = render(<ExchangeScreen points={60} offers={offers} onBuy={onBuy} onExit={vi.fn()} scale={2} />)
    expect(screen.getAllByRole('button', { name: /PB/ })).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'RESTOS, 48 PB' }))
    expect(screen.getByRole('status')).toHaveTextContent('¿Canjear RESTOS por 48 PB?')
    fireEvent.click(screen.getByRole('button', { name: 'Sí, canjear' }))
    expect(onBuy).toHaveBeenCalledWith('leftovers')
    expect(screen.getByRole('status')).toHaveTextContent('¡Has obtenido RESTOS! Está en la MOCHILA.')
    fireEvent.click(screen.getByRole('button', { name: 'Desplazar la lista hacia abajo' }))
    fireEvent.click(screen.getByRole('button', { name: 'ROCA DEL REY, 64 PB, no te alcanza' }))
    expect(screen.getByRole('status')).toHaveTextContent('No tienes suficientes Puntos Batalla.')
    expect(onBuy).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('SALIR vuelve a la Ruta', () => {
    const onExit = vi.fn()
    render(<ExchangeScreen points={0} offers={offers.slice(0, 2)} onBuy={vi.fn()} onExit={onExit} scale={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Salir del canje y volver a la ruta' }))
    expect(onExit).toHaveBeenCalled()
  })
})
