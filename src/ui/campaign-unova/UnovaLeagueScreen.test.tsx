import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { mockCampaignCanvas } from '../../test-utils/campaignUi'
import { uiAsset } from '../common/uiAssets'
import { unovaKit } from './unovaKit'
import { UnovaLeagueScreen } from './UnovaLeagueScreen'

// UT-231 · Liga de Teselia (maqueta del 14/11/2026): ficha del rival al estilo de la Ruta; abajo, la pantalla de equipo del diario con los
// participantes en verde y su orden, los demás en azul y los caídos en rojo; ACEPTAR fija la plantilla.
mockCampaignCanvas()
const rival = unovaKit.encounters.find((encounter) => encounter.id === 'catleya')!
const member = (id: string, fainted = false) => ({ id, species: id, name: id, level: 52, hp: 160, fainted })
const members = [member('samurott'), member('excadrill'), member('chandelure', true)]

function mount(roster: string[] | null = null) {
  const onAccept = vi.fn()
  const onCancel = vi.fn()
  const result = render(<UnovaLeagueScreen rival={rival} beaten={2} members={members} roster={roster} speciesName={(id) => id}
    onAccept={onAccept} onCancel={onCancel} scale={2} />)
  return { ...result, onAccept, onCancel }
}
const plate = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}, nivel`) })

describe('Liga de Teselia', () => {
  it('la ficha enseña al rival con el progreso de la Liga y la caja cerrada', () => {
    mount()
    const card = screen.getByRole('region', { name: 'Ficha de Catleya' })
    expect(card).toHaveTextContent('ALTO MANDO CATLEYA')
    expect(card).toHaveTextContent('Liga Pokémon: 2 de 5 superados')
    expect(card).toHaveTextContent('La CAJA está cerrada')
  })

  it('tocar elige en orden (placa verde con 1.º y 2.º); un caído no es apto; ACEPTAR devuelve el orden', () => {
    const { onAccept, container } = mount()
    fireEvent.click(plate('excadrill'))
    fireEvent.click(plate('samurott'))
    expect(plate('excadrill')).toHaveAttribute('aria-pressed', 'true')
    expect(plate('excadrill')).toHaveTextContent('1.º')
    expect(plate('samurott')).toHaveTextContent('2.º')
    expect((plate('excadrill') as HTMLElement).style.backgroundImage).toContain(uiAsset('party/panel-green-right-lit.png'))
    fireEvent.click(plate('chandelure'))
    expect(screen.getByRole('status')).toHaveTextContent('Este POKéMON no es apto.')
    expect((plate('chandelure') as HTMLElement).style.backgroundImage).toContain('panel-red')
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar participantes de la Liga' }))
    expect(onAccept).toHaveBeenCalledWith(['excadrill', 'samurott'])
    expect(container.querySelector('.bt-party')).not.toBeNull()
  })

  it('sin nadie elegido no acepta; con la plantilla fijada no cambia; volver cancela', () => {
    const first = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar participantes de la Liga' }))
    expect(first.onAccept).not.toHaveBeenCalled()
    first.unmount()
    const { onCancel } = mount(['samurott'])
    fireEvent.click(plate('excadrill'))
    expect(plate('excadrill')).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: /Volver|Cancelar/ }))
    expect(onCancel).toHaveBeenCalled()
  })
})
