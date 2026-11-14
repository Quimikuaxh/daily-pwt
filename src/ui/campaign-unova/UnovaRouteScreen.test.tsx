import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockCampaignCanvas } from '../../test-utils/campaignUi'
import { unovaKit } from './unovaKit'
import { UnovaRouteScreen } from './UnovaRouteScreen'
import { MAP_TOP, UNOVA_PLACES } from './unovaRoute'

// UT-217 · Ruta de Teselia (maqueta A3 aprobada el 13/11/2026): mapa de N2/B2 con los ocho gimnasios y la Liga, ficha con el equipo en
// cuadrícula, medallas en la ficha y la Liga recorrida con flechas.
mockCampaignCanvas()
const { places, encounters } = unovaKit
const league = { rivals: encounters.filter((encounter) => encounter.kind !== 'gym'), next: 0 }
const mount = (badges = 0, extra: { next?: number; showBadges?: boolean } = {}) =>
  render(<UnovaRouteScreen places={places} badges={badges} speciesName={(id) => id} league={{ ...league, next: extra.next ?? 0 }}
    showBadges={extra.showBadges} scale={2} />)

describe('Ruta de Teselia', () => {
  it('los lugares siguen el orden de los gimnasios y acaban en la Liga con Iris', () => {
    expect(places.map((place) => place.id)).toEqual(['cheren', 'hiedra', 'camus', 'camila', 'yakon', 'gerania', 'lirio', 'ciprian', 'iris'])
    expect(places.map((place) => place.gym)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, null])
    expect(new Set(UNOVA_PLACES.map((place) => `${place.x},${place.y}`)).size).toBe(UNOVA_PLACES.length)
  })

  it('elige el próximo gimnasio, coloca su botón sobre su círculo y cambia la ficha al elegir otro', async () => {
    const user = userEvent.setup()
    mount(1)
    const virbank = screen.getByRole('button', { name: /Ciudad Hormigón, gimnasio 2, próximo/ })
    expect(virbank).toHaveAttribute('aria-pressed', 'true')
    expect(virbank).toHaveStyle({ left: `${66 - 8}px`, top: `${MAP_TOP + 124 - 8}px` })
    const card = screen.getByRole('region', { name: 'Ficha de Hiedra' })
    expect(card).toHaveTextContent('LÍDER HIEDRA')
    expect(card).toHaveTextContent('Gimnasio 2 · Ciudad Hormigón')
    expect(card).toHaveTextContent('PRÓXIMO · Nv. máx. 18')
    expect(card).toHaveTextContent('Veneno')
    await user.click(screen.getByRole('button', { name: /Ciudad Engobe/ }))
    const cheren = await screen.findByRole('region', { name: 'Ficha de Cheren' })
    expect(cheren).toHaveTextContent('SUPERADO · Medalla Básica')
    expect(within(cheren).getAllByRole('listitem', { hidden: false }).filter((item) => item.getAttribute('aria-label'))).toHaveLength(places[0].rival.team.length)
  })

  it('las medallas van en la ficha, encendidas las ganadas; con los paneles laterales no salen', () => {
    const { container, unmount } = mount(3)
    const lit = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '').filter((src) => /medalla-\d\.png$/.test(src))
    expect(lit).toHaveLength(3)
    expect(screen.getByRole('img', { name: 'Medallas: 3 de 8' })).toBeInTheDocument()
    unmount()
    mount(3, { showBadges: false })
    expect(screen.queryByRole('img', { name: 'Medallas: 3 de 8' })).not.toBeInTheDocument()
  })

  it('la Liga empieza en el rival que toca y las flechas recorren los cinco hasta la campeona', async () => {
    const user = userEvent.setup()
    mount(8, { next: 4 })
    expect(screen.getByRole('region', { name: 'Ficha de Iris' })).toHaveTextContent('CAMPEONA IRIS')
    expect(screen.queryByRole('button', { name: /Ver la ficha de Iris/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `Ver la ficha de ${league.rivals[3].nameEs}` }))
    const elite = await screen.findByRole('region', { name: `Ficha de ${league.rivals[3].nameEs}` })
    expect(elite).toHaveTextContent(`ALTO MANDO ${league.rivals[3].nameEs.toUpperCase()}`)
    expect(elite).toHaveTextContent('SUPERADO')
  })
})
