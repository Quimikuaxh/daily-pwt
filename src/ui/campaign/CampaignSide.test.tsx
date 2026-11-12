import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockCampaignCanvas } from '../../test-utils/campaignUi'
import { BattlePanel, CampaignCard, TeamPanel } from './CampaignSide'
import type { SideMon } from './sidePanelsModel'

mockCampaignCanvas()
const mon = (index: number, species: string, extra: Partial<SideMon> = {}): SideMon => ({
  index, species, level: 15, hp: 40, maxHp: 40, percentOnly: false, status: null, fainted: false, active: index === 0,
  item: 'oranberry', ability: 'overgrow', stats: { hp: 40, atk: 21, def: 19, spa: 26, spd: 23, spe: 31 },
  moves: [{ id: 'pound', pp: 35, maxPp: 35 }, { id: 'leer', pp: 30, maxPp: 30 }], ...extra,
})
const names = {
  nameOf: (species: string) => species.toUpperCase(), typesOf: () => ['grass'], moveName: (id: string) => id.toUpperCase(), moveType: () => 'normal',
  itemName: (id: string) => `OBJ-${id}`, abilityName: (id: string) => `HAB-${id}`,
}

// UT-199 (Jose, 12/11/2026): paneles laterales de la campaña (ficha, equipo y combate).
describe('paneles laterales', () => {
  it('«Tu campaña» da en texto los datos de la ficha y las medallas', () => {
    render(<CampaignCard points={140} minutes={75} fainted={1} species={4} box={2} next="PETRA · Nv15" badges={1} />)
    for (const text of ['140 PB', '1:15', 'PETRA · Nv15', '1 de 8']) expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('«Tu equipo» nombra a cada Pokémon con su objeto', () => {
    render(<TeamPanel party={[{ species: 'treecko', name: 'TREECKO', level: 15, hp: 40, maxHp: 40, item: 'oranberry' }, null]} itemName={(id) => `OBJ-${id}`} />)
    expect(screen.getByText('TREECKO, nivel 15, lleva OBJ-oranberry')).toBeInTheDocument()
  })

  // Jose, 12/11/2026: también la caja, con los caídos marcados.
  it('«Tu equipo» enseña la caja con los caídos', () => {
    const { container } = render(<TeamPanel party={[null]} box={[{ species: 'ralts', name: 'RALTS', fainted: false }, { species: 'zubat', name: 'ZUBAT', fainted: true }]} itemName={(id) => id} />)
    expect(screen.getByText('En la caja: RALTS, ZUBAT (caído)')).toBeInTheDocument()
    expect(container.querySelectorAll('img.campaign-side-fainted')).toHaveLength(1)
  })

  it('el panel del jugador enseña estadísticas, objeto, habilidad y movimientos; pulsar otro enseña su ficha', async () => {
    const { container } = render(<BattlePanel title="TU EQUIPO" mons={[mon(0, 'treecko'), mon(1, 'ralts', { item: '' })]} boosts={{ atk: 1 }} {...names} />)
    const sheet = within(container.querySelector('dl')!)
    expect(sheet.getByText(/ATAQUE 21\+1/)).toBeInTheDocument()
    expect(sheet.getByText('OBJ-oranberry')).toBeInTheDocument()
    expect(sheet.getByText('POUND, LEER')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver a RALTS' }))
    expect(sheet.getByText(/^RALTS, nivel 15/)).toBeInTheDocument()
    expect(sheet.getByText('NINGUNO')).toBeInTheDocument()
  })

  it('el del rival lleva su sprite y su equipo, con habilidad y ataques pero sin estadísticas ni objeto', () => {
    const { container } = render(<BattlePanel rival={{ trainer: 'petra' }} title="PETRA" mons={[mon(0, 'geodude', { percentOnly: true, hp: 64, maxHp: 100 }), mon(1, 'nosepass')]} boosts={null} {...names} />)
    const sheet = within(container.querySelector('dl')!)
    expect(sheet.getByText(/GEODUDE, nivel 15, 64 % PS/)).toBeInTheDocument()
    expect(sheet.getByText('HAB-overgrow')).toBeInTheDocument()
    expect(sheet.getByText('POUND, LEER')).toBeInTheDocument()
    expect(sheet.queryByText(/ATAQUE/)).toBeNull()
    expect(sheet.queryByText('OBJ-oranberry')).toBeNull()
    expect(container.querySelector('img[src$="lider-petra.png"]')).not.toBeNull()
    expect(screen.getAllByRole('button', { name: /^Ver a / })).toHaveLength(2)
  })
})
