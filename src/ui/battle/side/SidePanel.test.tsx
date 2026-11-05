import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getDailyChallenge } from '../../../core/challenge'
import { loadGameData } from '../../../data/gameData'
import { mkView, pMon, rMon } from '../../../test-utils/view'
import type { BattleView } from '../../../battle/protocol'
import { partyMembers, requestFromView, rivalMembers } from '../party/partyModel'
import { SidePanel } from './SidePanel'

// UT-153 · Paneles laterales (RF-44c, DEC-81): el reto del 05/11/2026 (Blaine), con Gengar contra Arcanine.
const data = loadGameData()
const challenge = getDailyChallenge('2026-11-05', data)
const view = (pActive = 0, rivalHp = 100) =>
  mkView({
    player: challenge.playerTeam.map((set, index) => pMon(set.species, index === 0 ? 76 : 150, 130)),
    rival: challenge.rivalTeam.map((set, index) => rMon(set.species, index === 1 ? 0 : index === 0 ? rivalHp : 100)),
    pActive,
  }) as unknown as BattleView
const players = (battleView: BattleView) => partyMembers(requestFromView(battleView, challenge.playerTeam), battleView, data, challenge.playerTeam)
const rivals = (battleView: BattleView) => rivalMembers(battleView, data, challenge.rivalTeam)

function renderPlayer(battleView = view()) {
  const own = players(battleView)
  return render(<SidePanel side="player" title="Tu equipo" members={own} boosts={{ spa: 1 }} opponent={rivals(battleView).find((member) => member.active) ?? null} chart={data.dex.typeChart} />)
}

describe('panel lateral (UT-153)', () => {
  it('enseña el que está en combate: Poké Balls, PS, estadísticas con sus subidas y bajadas, objeto, habilidad y movimientos con PP', () => {
    renderPlayer()
    const panel = screen.getByRole('region', { name: 'Datos: Tu equipo' })
    expect(within(panel).getByRole('img', { name: '6 de 6 en pie' })).toBeInTheDocument()
    const card = within(panel).getByRole('article', { name: 'Gengar' })
    expect(card).toHaveTextContent('76/130')
    // At. Esp. 145 (el valor original, Jose 05/11/2026) con su «^» debajo.
    expect(within(card).getByLabelText('Estadísticas')).toHaveTextContent(/AtE145 \+1Df/)
    expect(card.querySelector('.bt-side-stage[data-dir="up"]')).not.toBeNull()
    expect(within(card).getByRole('button', { name: 'Ficha del objeto Baya Yapati' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Ficha del movimiento Bola Sombra' })).toHaveTextContent('24/24')
    expect(screen.getByText(/Pulsa un movimiento/)).toBeInTheDocument()
  })

  // Cambio de requisito (Jose, 05/11/2026): la franja de eficacia queda desactivada; su cálculo sigue probado en UT-152.
  it('al pulsar un movimiento sale su ficha (sin la franja de eficacia); al pulsarlo otra vez se quita', async () => {
    const user = userEvent.setup()
    renderPlayer()
    const shadowBall = screen.getByRole('button', { name: 'Ficha del movimiento Bola Sombra' })
    await user.click(shadowBall)
    expect(shadowBall).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Bola Sombra' })).toBeInTheDocument()
    expect(screen.getByText('Lanza una bola oscura que puede bajar la Defensa Especial del objetivo.')).toBeInTheDocument()
    expect(screen.queryByText('Eficaz contra Arcanine')).toBeNull()
    await user.click(shadowBall)
    expect(screen.queryByRole('heading', { name: 'Bola Sombra' })).toBeNull()
  })

  it('objeto y habilidad, con su descripción', async () => {
    const user = userEvent.setup()
    renderPlayer()
    await user.click(screen.getByRole('button', { name: 'Ficha del objeto Baya Yapati' }))
    expect(screen.getByText('Si la lleva un Pokémon, le sube el Ataque Especial en un momento de apuro.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ficha de la habilidad Levitación' }))
    expect(screen.getByRole('heading', { name: 'Levitación' })).toBeInTheDocument()
  })

  it('el rival: PS en %, sus PP y la ficha de sus movimientos', async () => {
    const user = userEvent.setup()
    const battleView = view(0, 62)
    render(<SidePanel side="rival" title="Blaine" members={rivals(battleView)} boosts={null} opponent={players(battleView).find((member) => member.active) ?? null} chart={data.dex.typeChart} />)
    expect(screen.getByRole('img', { name: '5 de 6 en pie' })).toBeInTheDocument()
    const card = screen.getByRole('article', { name: 'Arcanine' })
    expect(card).toHaveTextContent('62 %')
    const bulldoze = within(card).getByRole('button', { name: 'Ficha del movimiento Terratemblor' })
    expect(bulldoze).toHaveTextContent('32/32')
    await user.click(bulldoze)
    expect(screen.getByRole('heading', { name: 'Terratemblor' })).toBeInTheDocument()
  })

  it('al pulsar uno de abajo lo enseña; cuando sale otro al campo vuelve solo al que está en combate', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPlayer()
    await user.click(screen.getByRole('button', { name: 'Ver los datos de Kingdra' }))
    expect(screen.getByRole('article', { name: 'Kingdra' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ficha del movimiento Hidrobomba' }))
    // Sale Scizor (el segundo) al campo.
    const next = view(1)
    rerender(<SidePanel side="player" title="Tu equipo" members={players(next)} boosts={null} opponent={rivals(next).find((member) => member.active) ?? null} chart={data.dex.typeChart} />)
    expect(screen.getByRole('article', { name: 'Scizor' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Hidrobomba' })).toBeNull()
  })
})

describe('subidas y bajadas en el panel (UT-153)', () => {
  it('solo las del que está en combate, también Precisión y Evasión; sin cambios, no hay línea', async () => {
    const user = userEvent.setup()
    const battleView = view()
    const { rerender } = render(<SidePanel side="player" title="Tu equipo" members={players(battleView)} boosts={{ atk: -2, accuracy: 1 }} opponent={null} chart={data.dex.typeChart} />)
    // Ataque 80 (original) con −2: «v» roja con el 2; Precisión, en su línea.
    expect(screen.getByLabelText('Estadísticas')).toHaveTextContent(/Ata802 −2Def/)
    expect(document.querySelector('.bt-side-stage[data-dir="down"]')).toHaveTextContent(/^2/)
    expect(screen.getByRole('list', { name: 'Subidas y bajadas' })).toHaveTextContent('Precisión +1')
    await user.click(screen.getByRole('button', { name: 'Ver los datos de Scizor' }))
    expect(screen.queryByRole('list', { name: 'Subidas y bajadas' })).toBeNull()
    expect(document.querySelector('.bt-side-stage')).toBeNull()
    rerender(<SidePanel side="player" title="Tu equipo" members={players(view(1))} boosts={{}} opponent={null} chart={data.dex.typeChart} />)
    expect(screen.queryByRole('list', { name: 'Subidas y bajadas' })).toBeNull()
  })
})
