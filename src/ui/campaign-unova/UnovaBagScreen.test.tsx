import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { loadGameData } from '../../data/gameData'
import { createCampaign, type CampaignState } from '../../core/nuzlocke/campaign'
import type { BagItem, Pocket } from '../campaign/bagModel'
import { UnovaBagScreen } from './UnovaBagScreen'
import { unovaBagContents } from './unovaBag'
import { unovaKit } from './unovaKit'
import { n2b2Ui } from './unovaRoute'

// UT-227 · Mochila de Teselia (maqueta del 14/11/2026): bolsillos de N2/B2 en el color del protagonista, dar un objeto, preguntar si
// cambiar el que lleva, OBJ. EVOL. y MT/MO solo para mirar; contenido con los objetos, nombres y MT de Teselia.
const data = loadGameData()
const item = (id: string, name: string, extra: Partial<BagItem> = {}): BagItem => ({ id, name, text: 'Texto.', free: 1, ...extra })
const pockets: Record<Pocket, BagItem[]> = {
  items: [item('leftovers', 'Restos'), item('expertbelt', 'Cinta Experto', { free: 2 })],
  berries: [item('oranberry', 'Baya Aranja', { free: Infinity })],
  evolution: [item('thunderstone', 'Piedra Trueno', { view: true })],
  machines: [item('tm01', 'MT01 Afilagarras', { view: true })],
}

function mount(holding: string | null = null, protagonist: 'brendan' | 'may' = 'brendan') {
  const onGive = vi.fn()
  const onClose = vi.fn()
  const result = render(<UnovaBagScreen protagonist={protagonist} member={{ species: 'patrat', name: 'Patrat', level: 13, hp: 40, item: holding }}
    contents={(pocket) => pockets[pocket]} itemName={(id) => (id === 'leftovers' ? 'Restos' : id)} onGive={onGive} onClose={onClose} scale={2} />)
  return { ...result, onGive, onClose }
}

describe('Mochila de Teselia', () => {
  it('elegir un objeto se lo da; con otro puesto, pregunta antes de cambiarlo', () => {
    const { onGive } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Cinta Experto, ×2' }))
    expect(onGive).toHaveBeenCalledWith('expertbelt')
  })

  it('si ya lleva otro, SÍ lo cambia', () => {
    const { onGive } = mount('leftovers')
    fireEvent.click(screen.getByRole('button', { name: 'Cinta Experto, ×2' }))
    expect(screen.getByRole('status')).toHaveTextContent('Patrat ya lleva Restos. ¿Cambiarlo?')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sí, cambiar el objeto' }))
    expect(onGive).toHaveBeenCalledWith('expertbelt')
  })

  it('los bolsillos se eligen tocándolos; OBJ. EVOL. y MT/MO son solo para mirar', () => {
    const { onGive } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'OBJ. EVOL.' }))
    expect(screen.getByRole('button', { name: 'OBJ. EVOL.' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Piedra Trueno' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bolsillo siguiente: MT/MO' }))
    fireEvent.click(screen.getByRole('button', { name: 'MT01 Afilagarras' }))
    expect(onGive).not.toHaveBeenCalled()
  })

  it('el fondo y la mochila van en el color del protagonista; CANCELAR cierra', () => {
    const { container, onClose } = mount(null, 'may')
    expect(container.querySelector(`img[src="${n2b2Ui('mochila-fondo-chica')}"]`)).not.toBeNull()
    expect(container.querySelector(`img[src="${n2b2Ui('mochila-chica-objetos-2')}"]`)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar: volver al equipo sin dar nada' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('el contenido sale de Teselia: Restos desde el tramo de Camus, MT por tramo y nombres de 5.ª generación', () => {
    const at = (encounterIndex: number): CampaignState => ({ ...createCampaign('bolsa', undefined, 'unova-n2b2'), encounterIndex, phase: 'prepare' })
    expect(unovaBagContents(at(1), 'items', 'x', unovaKit.definition, data).map((each) => each.id)).not.toContain('leftovers')
    expect(unovaBagContents(at(2), 'items', 'x', unovaKit.definition, data).find((each) => each.id === 'leftovers')?.name).toBe('Restos')
    const machines = unovaBagContents(at(1), 'machines', 'x', unovaKit.definition, data)
    expect(machines.length).toBeGreaterThan(0)
    expect(machines.every((each) => each.view && /^M[TO]\d\d /.test(each.name))).toBe(true)
  })
})
