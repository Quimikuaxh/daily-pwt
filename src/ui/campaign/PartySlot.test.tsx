import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PartySlot } from './PartySlot'
import { PartyPlate } from '../campaign-unova/UnovaPartyPlates'
import { ConsoleStage } from '../console/ConsoleStage'
import { emeraldTheme } from '../console/themes/emerald'
import type { ReactNode } from 'react'

const inStage = (node: ReactNode) => <ConsoleStage theme={emeraldTheme} scale={1} screens={[node, null]} />

// UT-246 (Jose, 17/11/2026): Equipo y PC y la Liga de los dos lockes enseñan el icono de objeto equipado del que lleva algo.
describe('icono de objeto equipado en los lockes (UT-246)', () => {
  const mon = { species: 'grovyle', name: 'GROVYLE', level: 20, hp: 50, maxHp: 50 }

  it('Hoenn: el hueco del que lleva objeto lo pinta donde party_menu.c (centro del icono + 4, + 10); sin objeto, no', () => {
    const { container, rerender } = render(inStage(<PartySlot i={1} mon={{ ...mon, item: 'quickclaw' }} state="normal" />))
    const icon = container.querySelector('.party-held-item')
    expect(icon).toHaveAttribute('src', expect.stringMatching(/emerald\/objeto-equipado\.png$/))
    expect((icon as HTMLElement).style.left).toBe('8px')
    rerender(inStage(<PartySlot i={1} mon={{ ...mon, item: null }} state="normal" />))
    expect(container.querySelector('.party-held-item')).toBeNull()
    rerender(inStage(<PartySlot i={1} mon={{ ...mon, item: 'quickclaw' }} state="normal" description="APTO" />))
    expect(container.querySelector('.party-held-item')).not.toBeNull()
  })

  it('Teselia: la placa del que lleva objeto lleva el icono de la pantalla de equipo de N2/B2', () => {
    const plate = { id: 'a', species: 'servine', name: 'Servine', level: 20, hp: 50, fainted: false }
    const { container, rerender } = render(<PartyPlate member={{ ...plate, item: 'scopelens' }} index={0} order={null} label="Servine" />)
    expect(container.querySelector('.bt-party-held')).toHaveAttribute('src', expect.stringMatching(/party\/held-item\.png$/))
    rerender(<PartyPlate member={plate} index={0} order={null} label="Servine" />)
    expect(container.querySelector('.bt-party-held')).toBeNull()
  })
})
