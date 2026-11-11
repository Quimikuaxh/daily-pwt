import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { campaignPlaces as places, mockCampaignCanvas } from '../../test-utils/campaignUi'
import { emeraldTheme } from '../console/themes/emerald'
import { RouteScreen } from './RouteScreen'

mockCampaignCanvas()
const mount = (badges = 0) => render(<RouteScreen places={places} badges={badges} speciesName={id => id} scale={2} />)

describe('Ruta y ficha del Domo', () => {
  it('selecciona la próxima ciudad por defecto y cambia la ficha y el nombre accesible al elegir otra', async () => {
    const user = userEvent.setup()
    mount(1)
    expect(screen.getByRole('button', { name: /PUEBLO AZULIZA/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: 'Ficha de Marcial' })).toHaveTextContent('LÍDER MARCIAL')
    await user.click(screen.getByRole('button', { name: /CIUDAD FÉRRICA/ }))
    expect(screen.getByRole('button', { name: /CIUDAD FÉRRICA/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /PUEBLO AZULIZA/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('region', { name: 'Ficha de Marcial' })).not.toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'Ficha de Petra' })
    expect(card).toHaveTextContent('LÍDER PETRA')
    expect(card).toHaveTextContent('MEDALLA PIEDRA')
    expect(within(card).getAllByRole('listitem')).toHaveLength(places[0].rival.team.length)
  })

  it('la Liga muestra al campeón Plubio y pagina con botones y teclado sin salir de los límites', async () => {
    const user = userEvent.setup()
    const { container } = mount(8)
    const card = screen.getByRole('region', { name: 'Ficha de Plubio' })
    expect(card).toHaveTextContent('CAMPEÓN PLUBIO')
    expect(within(card).getAllByRole('listitem')).toHaveLength(6)
    const icons = () => [...container.querySelectorAll<HTMLImageElement>('.mon-icon')].map(img => img.getAttribute('src'))
    const first = icons()
    expect(first).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Ver página 1 de 2 del equipo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver página 2 de 2 del equipo' }))
    expect(icons()).not.toEqual(first)
    const previous = screen.getByRole('button', { name: 'Ver página 1 de 2 del equipo' })
    fireEvent.keyDown(previous, { key: 'ArrowRight' })
    expect(icons()).not.toEqual(first)
    fireEvent.keyDown(previous, { key: 'ArrowLeft' })
    expect(icons()).toEqual(first)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ver página 2 de 2 del equipo' }), { key: 'ArrowRight' })
    expect(icons()).not.toEqual(first)
    await user.click(screen.getByRole('button', { name: /CIUDAD FÉRRICA/ }))
    expect(screen.queryByRole('button', { name: /Ver página/ })).not.toBeInTheDocument()
    expect(icons()).toHaveLength(3)
  })

  it.each([0, 1, 5, 8])('coloca el icono del protagonista con %i medallas', (badges) => {
    const { container } = mount(badges)
    const player = [...container.querySelectorAll('img')].find(img => img.getAttribute('src') === emeraldTheme.asset('mapa-jugador'))!
    const spot = badges ? places[badges - 1] : { x: 5, y: 13 }
    expect(player).toHaveStyle({ left: `${spot.x * 8 - 4}px`, top: `${spot.y * 8 - 4}px` })
    expect(player).toHaveAttribute('alt', '')
  })
})
