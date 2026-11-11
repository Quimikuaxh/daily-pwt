import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TeamScreen } from './TeamScreen'
import type { TeamLayout, TeamMon } from './teamModel'

// UT-173 · Equipo y PC (D7): mover tocando origen y destino, Esc, límite del rival, bajas inmóviles y ACEPTAR con el orden del equipo.
const mon = (id: string, hp = 50): TeamMon => ({ id, species: id, name: id.toUpperCase(), level: 19, hp, item: null })
const mons = Object.fromEntries(['grovyle', 'machop', 'wingull', 'slakoth', 'ralts'].map((id) => [id, mon(id)]))
const fill = (ids: (string | null)[], n: number) => [...ids, ...Array(n - ids.length).fill(null)]
const layout: TeamLayout = {
  party: fill(['grovyle', 'machop', 'wingull'], 6),
  boxes: [{ ko: false, mons: fill(['slakoth'], 30) }, { ko: true, mons: fill(['ralts'], 30) }],
}

function mount() {
  const onAccept = vi.fn()
  const onCancel = vi.fn()
  const onMoves = vi.fn()
  render(<TeamScreen mons={mons} initial={layout} limit={3} rivalName="MARCIAL" itemName={(id) => id} onAccept={onAccept} onCancel={onCancel} onMoves={onMoves} scale={2} />)
  return { onAccept, onCancel, onMoves }
}
const status = () => screen.getByRole('status').textContent

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => { vi.restoreAllMocks() })

describe('Equipo y PC', () => {
  it('tocar un Pokémon de la caja y luego uno del equipo los intercambia; ACEPTAR devuelve el equipo en orden', () => {
    const { onAccept } = mount()
    // Cambio de requisito (Jose, 11/11/2026): tocar abre el menú del PC; MOVER lo coge.
    fireEvent.click(screen.getByRole('button', { name: /^CAJA 1, hueco 1: SLAKOTH/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover a SLAKOTH' }))
    expect(status()).toContain('¿Mover adónde?')
    expect(status()).toContain('Moviendo SLAKOTH.')
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 1: GROVYLE/ }))
    expect(screen.getByRole('button', { name: /^Equipo, puesto 1: SLAKOTH/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^CAJA 1, hueco 1: GROVYLE/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar el equipo y preparar los movimientos' }))
    expect(onAccept).toHaveBeenCalledWith(['slakoth', 'machop', 'wingull'])
  })

  it('Esc suelta lo cogido sin moverlo; los huecos de más avisan del límite', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 2: MACHOP/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover a MACHOP' }))
    fireEvent.keyDown(screen.getByRole('button', { name: /^Equipo, puesto 2: MACHOP, nivel 19, 50 de 50 PS, cogido$/ }), { key: 'Escape' })
    expect(status()).toContain('Elige un POKéMON.')
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 4: sin plaza$/ }))
    expect(status()).toContain('MARCIAL lleva 3: no hay más plazas.')
  })

  it('las bajas están en su caja, no se pueden coger y se cuentan en el texto accesible', () => {
    mount()
    expect(screen.getByText('Bajas permanentes: RALTS. No se pueden mover.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Caja siguiente: BAJAS' }))
    fireEvent.click(screen.getByRole('button', { name: /^BAJAS, hueco 1: RALTS.*debilitado$/ }))
    expect(status()).toContain('Las bajas no vuelven al equipo.')
  })

  it('el menú del PC ofrece MOVER, MOVIMIENTOS y CANCELAR; MOVIMIENTOS abre los de ese Pokémon y Esc lo cierra', () => {
    const { onMoves } = mount()
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 3: WINGULL/ }))
    const menu = screen.getByRole('menu', { name: 'Opciones de WINGULL' })
    expect(status()).toContain('¿Qué hacer con WINGULL?')
    expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('aria-label'))).toEqual(['Mover a WINGULL', 'Movimientos de WINGULL', 'Cerrar el menú'])
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^CAJA 1, hueco 1: SLAKOTH/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Movimientos de SLAKOTH' }))
    expect(onMoves).toHaveBeenCalledWith('slakoth')
  })

  it('CERRAR y CANCELAR vuelven a la ruta', () => {
    const { onCancel } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el PC y volver a la ruta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver a la ruta' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
