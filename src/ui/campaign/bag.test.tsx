import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CampaignState } from '../../core/nuzlocke/campaign'
import { bagContents, itemName, scrollFor, VISIBLE_ROWS, type BagItem } from './bagModel'
import { BagScreen } from './BagScreen'

// UT-186 · Mochila de la campaña (D7): bolsillos, unidades libres, desplazamiento de la lista y dar o cambiar el objeto.
const member = (id: string, item?: string, fainted = false) => ({ id, species: 'machop', level: 40, history: [], fainted, victories: 0, ...(item ? { item } : {}) })
const at = (encounterIndex: number, members: ReturnType<typeof member>[], purchases: string[] = []) =>
  ({ encounterIndex, members, purchases } as unknown as CampaignState)

describe('contenido de la Mochila', () => {
  it('OBJETOS: los conseguidos hasta el hito y los comprados; BAYAS aparte; nombres de la época', () => {
    const early = bagContents(at(0, [member('a')]), 'items', 'a').map((item) => item.id)
    expect(early).toContain('miracleseed')
    expect(early).not.toContain('charcoal')
    expect(bagContents(at(0, [member('a')], ['leftovers']), 'items', 'a').map((item) => item.id)).toContain('leftovers')
    expect(bagContents(at(0, [member('a')]), 'berries', 'a').every((item) => item.name.startsWith('BAYA '))).toBe(true)
    expect(itemName('choiceband')).toBe('CIN. ELEGIDA')
  })

  it('lo que lleva otro miembro vivo no está libre; lo que lleva él o un caído, sí', () => {
    expect(bagContents(at(0, [member('a'), member('b', 'miracleseed')]), 'items', 'a').map((item) => item.id)).not.toContain('miracleseed')
    expect(bagContents(at(0, [member('a', 'miracleseed')]), 'items', 'a').map((item) => item.id)).toContain('miracleseed')
    expect(bagContents(at(0, [member('a'), member('b', 'miracleseed', true)]), 'items', 'a').map((item) => item.id)).toContain('miracleseed')
  })

  it('la lista se desplaza para que el cursor se vea en sus 8 filas', () => {
    expect(VISIBLE_ROWS).toBe(8)
    expect(scrollFor(3, 0, 20)).toBe(0)
    expect(scrollFor(8, 0, 20)).toBe(1)
    expect(scrollFor(19, 0, 20)).toBe(12)
    expect(scrollFor(2, 5, 20)).toBe(2)
  })
})

describe('pantalla de la Mochila', () => {
  beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
  afterEach(() => { vi.restoreAllMocks() })
  const many: BagItem[] = Array.from({ length: 12 }, (_, i) => ({ id: `o${i}`, name: `OBJETO ${i}`, text: 'Línea', free: 1 }))
  const mount = (item: string | null) => {
    const onGive = vi.fn()
    const onClose = vi.fn()
    render(<BagScreen protagonist="brendan" member={{ species: 'machop', name: 'MACHOP', level: 40, hp: 114, item }}
      contents={(pocket) => (pocket === 'items' ? many : [{ id: 'oranberry', name: 'BAYA ARANJA', text: 'Restaura', free: Infinity }])} onGive={onGive} onClose={onClose} scale={2} />)
    return { onGive, onClose }
  }

  it('con más objetos de los que caben, enseña 8 filas y la flecha de bajar; bajar desplaza y aparece la de subir', () => {
    mount(null)
    expect(screen.getAllByRole('button', { name: /^OBJETO \d+/ })).toHaveLength(8)
    expect(screen.queryByRole('button', { name: 'Desplazar la lista hacia arriba' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Desplazar la lista hacia abajo' }))
    expect(screen.getByRole('button', { name: /^OBJETO 8,/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^OBJETO 0,/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Desplazar la lista hacia arriba' })).toBeInTheDocument()
  })

  it('cambia de bolsillo; sin objeto da directamente; con objeto pregunta si cambiarlo', () => {
    const { onGive } = mount('o5')
    fireEvent.click(screen.getByRole('button', { name: 'Bolsillo siguiente: BAYAS' }))
    expect(screen.getByRole('button', { name: 'BAYA ARANJA' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'BAYA ARANJA' }))
    expect(screen.getByRole('status')).toHaveTextContent('MACHOP ya lleva O5. ¿Cambiarlo?')
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cambiar el objeto' }))
    expect(onGive).toHaveBeenCalledWith('oranberry')
  })

  it('CERRAR MOCHILA vuelve sin dar nada', () => {
    const { onGive, onClose } = mount(null)
    fireEvent.click(screen.getByRole('button', { name: 'Bolsillo siguiente: BAYAS' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar la Mochila y volver al equipo' }))
    expect(onClose).toHaveBeenCalled()
    expect(onGive).not.toHaveBeenCalled()
  })
})
