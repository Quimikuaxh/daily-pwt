import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModesDialog } from './ModesDialog'

describe('Modos de juego', () => {
  it('marca el reto diario como actual y permite cerrar sin abrir otra campaña', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onOpen = vi.fn()
    render(<ModesDialog modes={[{ id: 'hoenn', label: 'Nuzlocke de Hoenn', hint: 'Campaña de Esmeralda', onOpen }]} onClose={onClose} />)
    // Cambio de requisito (axe label-content-name-mismatch, 12/11/2026): el nombre del botón es su texto visible (título y descripción).
    const daily = screen.getByRole('button', { name: /Reto diario/ })
    expect(daily).toHaveAttribute('aria-current', 'page')
    expect(daily).toHaveAccessibleDescription()
    expect(screen.getByRole('button', { name: /^Nuzlocke de Hoenn/ })).toHaveAccessibleDescription('Campaña de Esmeralda')
    await user.click(daily)
    expect(onClose).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('elegir Nuzlocke cierra la ventana antes de abrir la campaña', async () => {
    const calls: string[] = []
    const user = userEvent.setup()
    render(<ModesDialog modes={[{ id: 'hoenn', label: 'Nuzlocke de Hoenn', hint: 'Campaña', onOpen: () => calls.push('open') }]} onClose={() => calls.push('close')} />)
    await user.click(screen.getByRole('button', { name: /^Nuzlocke de Hoenn/ }))
    expect(calls).toEqual(['close', 'open'])
  })
})
