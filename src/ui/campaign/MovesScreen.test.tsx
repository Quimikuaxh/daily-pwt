import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MovesScreen } from './MovesScreen'
import type { MoveInfo } from './movesModel'

// UT-176 · Pantalla Movimientos (D7): aprender con hueco, olvidar con cuatro, ya conocido, Esc, SALIR y texto accesible.
const move = (id: string, name: string, level: number): MoveInfo => ({ id, name, type: 'normal', typeName: 'NORMAL', category: 'Physical', power: 40, accuracy: 100, pp: 35, text: 'Línea uno\nlínea dos.', source: { level } })
const legal = [move('tackle', 'PLACAJE', 1), move('growl', 'GRUÑIDO', 4), move('bite', 'MORDISCO', 7), move('leer', 'MALICIOSO', 10), move('rage', 'FURIA', 13)]

function mount(equipped: string[]) {
  const onChange = vi.fn()
  const onExit = vi.fn()
  render(<MovesScreen mon={{ species: 'totodile', name: 'TOTODILE', level: 15, dex: 158 }} legal={legal} equipped={equipped} onChange={onChange} onExit={onExit} scale={2} />)
  return { onChange, onExit }
}
const status = () => screen.getByRole('status').textContent

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => { vi.restoreAllMocks() })

describe('Movimientos', () => {
  it('con hueco libre, elegir uno de la lista lo aprende', () => {
    const { onChange } = mount(['tackle'])
    fireEvent.click(screen.getByRole('button', { name: /^GRUÑIDO, NORMAL, físico, nivel 4$/ }))
    expect(onChange).toHaveBeenCalledWith(['tackle', 'growl'])
    expect(status()).toBe('¡TOTODILE aprendió GRUÑIDO!')
  })

  it('con cuatro pide cuál olvidar; Esc lo cancela y elegir un hueco lo sustituye', () => {
    const { onChange } = mount(['tackle', 'growl', 'bite', 'leer'])
    fireEvent.click(screen.getByRole('button', { name: /^FURIA/ }))
    expect(status()).toBe('¿Qué movimiento debería olvidar TOTODILE?')
    fireEvent.keyDown(screen.getByRole('button', { name: /^FURIA/ }), { key: 'Escape' })
    expect(status()).toBe('¿Qué movimiento debería aprender TOTODILE?')
    fireEvent.click(screen.getByRole('button', { name: /^FURIA/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Olvidar MORDISCO' }))
    expect(onChange).toHaveBeenCalledWith(['tackle', 'growl', 'rage', 'leer'])
  })

  it('uno ya equipado lo dice y no cambia nada; SALIR vuelve al equipo', () => {
    const { onChange, onExit } = mount(['tackle'])
    fireEvent.click(screen.getByRole('button', { name: /^PLACAJE.*ya equipado$/ }))
    expect(status()).toBe('TOTODILE ya conoce PLACAJE.')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al equipo' }))
    expect(onExit).toHaveBeenCalled()
  })

  it('el texto accesible lista los equipados y describe el señalado', () => {
    mount(['tackle', 'bite'])
    const region = screen.getByRole('region', { name: 'Movimientos' })
    expect(region).toHaveTextContent('TOTODILE, nivel 15')
    expect(region).toHaveTextContent('PLACAJEMORDISCO')
    expect(region).toHaveTextContent('PLACAJE: NORMAL, físico, potencia 40, precisión 100, 35 PP. Línea uno línea dos.')
  })
})
