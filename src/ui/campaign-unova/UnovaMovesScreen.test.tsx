import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { loadGameData } from '../../data/gameData'
import type { MoveInfo } from '../campaign/movesModel'
import { unovaKit } from './unovaKit'
import { UnovaMovesScreen } from './UnovaMovesScreen'
import { unovaSummaryMember } from './unovaSummary'

// UT-226 · Movimientos de Teselia (maqueta del 14/11/2026): la página de movimientos del diario con la lista de lo que puede aprender;
// elegir lo aprende, con cuatro se elige la placa que olvida, la categoría es la de Gen 5 y SALIR vuelve.
const data = loadGameData()
const info = (id: string, level: number): MoveInfo =>
  ({ id, name: id, type: 'normal', typeName: '', category: 'Physical', power: null, accuracy: null, pp: 10, text: '', source: { level } })
const legal = [info('tackle', 1), info('growl', 1), info('ember', 7), info('flamethrower', 20), info('bite', 15)]

function mount(equipped: string[]) {
  const onChange = vi.fn()
  const onExit = vi.fn()
  const member = unovaSummaryMember({ species: 'tepig', level: 20, moves: equipped }, unovaKit.definition, data)
  render(<UnovaMovesScreen mon={{ species: 'tepig', name: 'TEPIG', level: 20, dex: 498 }} legal={legal} equipped={equipped}
    onChange={onChange} onExit={onExit} member={member} data={data} scale={2} />)
  return { onChange, onExit }
}
const row = (name: RegExp) => screen.getByRole('button', { name })
const status = () => screen.getByRole('status').textContent

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => { vi.restoreAllMocks() })

describe('Movimientos de Teselia', () => {
  it('con hueco libre, elegir de la lista lo aprende; uno que ya lleva lo avisa', () => {
    const { onChange } = mount(['tackle', 'growl'])
    fireEvent.click(row(/^Ascuas, /))
    expect(onChange).toHaveBeenCalledWith(['tackle', 'growl', 'ember'])
    expect(status()).toContain('¡Tepig aprendió Ascuas!')
    fireEvent.click(row(/^Placaje, .*ya equipado$/))
    expect(status()).toContain('Tepig ya conoce Placaje.')
  })

  it('con cuatro, pide cuál olvidar y la placa tocada lo sustituye', () => {
    const { onChange } = mount(['tackle', 'growl', 'ember', 'bite'])
    fireEvent.click(row(/^Lanzallamas, /))
    expect(status()).toContain('¿Qué movimiento debería olvidar Tepig?')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Gruñido' }))
    expect(onChange).toHaveBeenCalledWith(['tackle', 'flamethrower', 'ember', 'bite'])
  })

  it('la categoría del texto accesible es la de Gen 5 (Mordisco, físico; Lanzallamas, especial) y SALIR vuelve', () => {
    const { onExit } = mount(['tackle'])
    expect(row(/^Mordisco, .*físico/)).toBeInTheDocument()
    expect(row(/^Lanzallamas, .*especial/)).toBeInTheDocument()
    fireEvent.click(row(/^Volver al equipo$/))
    expect(onExit).toHaveBeenCalled()
  })
})
