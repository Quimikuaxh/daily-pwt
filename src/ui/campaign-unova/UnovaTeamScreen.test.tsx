import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { loadGameData } from '../../data/gameData'
import type { TeamLayout, TeamMon } from '../campaign/teamModel'
import { unovaKit } from './unovaKit'
import { UnovaTeamScreen } from './UnovaTeamScreen'
import { n2b2Ui } from './unovaRoute'
import { unovaSummaryMember } from './unovaSummary'

// UT-225 · Equipo y PC de Teselia (maqueta del 14/11/2026): arriba la pantalla de datos del diario con el señalado; abajo el PC de N2/B2
// (fondo de cada caja, flechas, rejilla de 6 x 5, equipo con el límite del rival, menú del PC, ACEPTAR y CANCELAR).
const data = loadGameData()
const mon = (id: string): TeamMon => ({ id, species: id, name: id.toUpperCase(), level: 20, hp: 50, item: null })
const ids = ['oshawott', 'patrat', 'pidove', 'lillipup', 'purrloin']
const mons = Object.fromEntries(ids.map((id) => [id, mon(id)]))
const fill = (list: (string | null)[], n: number) => [...list, ...Array(n - list.length).fill(null)]
const layout: TeamLayout = {
  party: fill(['oshawott', 'patrat', 'pidove'], 6),
  boxes: [{ ko: false, mons: fill(['lillipup'], 30) }, { ko: true, mons: fill(['purrloin'], 30) }],
}
const details = (id: string) => unovaSummaryMember({ species: mons[id].species, level: 20 }, unovaKit.definition, data)

function mount(extra: { readOnly?: boolean } = {}) {
  const onAccept = vi.fn()
  const onCancel = vi.fn()
  const onMoves = vi.fn()
  const result = render(<UnovaTeamScreen mons={mons} initial={layout} limit={3} rivalName="HIEDRA" itemName={(id) => id} onAccept={onAccept}
    onCancel={onCancel} onMoves={onMoves} onGiveItem={vi.fn()} onTakeItem={vi.fn()} details={details} data={data} scale={2} {...extra} />)
  return { ...result, onAccept, onCancel, onMoves }
}
const status = () => screen.getByRole('status').textContent

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => { vi.restoreAllMocks() })

describe('Equipo y PC de Teselia', () => {
  it('MOVER coge al de la caja y tocar uno del equipo los intercambia; ACEPTAR devuelve el equipo en orden', () => {
    const { onAccept } = mount()
    fireEvent.click(screen.getByRole('button', { name: /^CAJA 1, hueco 1: LILLIPUP/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover a LILLIPUP' }))
    expect(status()).toContain('¿Mover adónde?')
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 1: OSHAWOTT/ }))
    expect(screen.getByRole('button', { name: /^Equipo, puesto 1: LILLIPUP/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar el equipo y preparar los movimientos' }))
    expect(onAccept).toHaveBeenCalledWith(['lillipup', 'patrat', 'pidove'])
  })

  it('el menú lleva MOVIMIENTOS y OBJETO; Esc lo cierra; los huecos de más avisan del límite', () => {
    const { onMoves } = mount()
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 2: PATRAT/ }))
    expect(screen.getByRole('menu', { name: 'Opciones de PATRAT' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Movimientos de PATRAT' }))
    expect(onMoves).toHaveBeenCalledWith('patrat')
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 5: sin plaza$/ }))
    expect(status()).toContain('HIEDRA lleva 3: no hay más plazas.')
  })

  it('las flechas pasan a BAJAS con su fondo; las bajas no se cogen', () => {
    const { container } = mount()
    expect(container.querySelector(`img[src="${n2b2Ui('caja-1')}"]`)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Caja siguiente: BAJAS' }))
    expect(container.querySelector(`img[src="${n2b2Ui('caja-2')}"]`)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^BAJAS, hueco 1: PURRLOIN.*debilitado$/ }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(status()).toContain('Las bajas no vuelven al equipo.')
  })

  it('arriba, la pantalla de datos del diario del señalado', () => {
    mount()
    expect(screen.getByRole('region', { name: /Oshawott/ })).toBeInTheDocument()
    fireEvent.pointerEnter(screen.getByRole('button', { name: /^Equipo, puesto 3: PIDOVE/ }))
    expect(screen.getByRole('region', { name: /Pidove/ })).toBeInTheDocument()
  })

  it('solo para mirar: sin ACEPTAR ni menú, y CANCELAR vuelve al draft', () => {
    const { onCancel } = mount({ readOnly: true })
    expect(screen.queryByRole('button', { name: /Aceptar el equipo/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Equipo, puesto 1: OSHAWOTT/ }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al draft' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
