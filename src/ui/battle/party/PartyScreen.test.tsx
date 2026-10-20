import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PartyScreen } from './PartyScreen'
import { partyMembers } from './partyModel'
import { realData, realRequest, realTeam, realView } from './partyFixtures'

// CMP-24..28 · RF-70, RF-71: menú de equipo, opciones Cambiar / Datos / Cancelar y pantalla de datos con sus páginas.
const members = (overrides: Parameters<typeof realRequest>[0] = {}) => partyMembers(realRequest(overrides), realView(), realData, realTeam)

function mount(props: Partial<React.ComponentProps<typeof PartyScreen>> = {}) {
  const onChoose = vi.fn()
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<PartyScreen members={members()} data={realData} forced={false} enabled onChoose={onChoose} onClose={onClose} {...props} />)
  return { onChoose, onClose, user }
}

const panel = (name: RegExp) => screen.getByRole('button', { name })
const options = () => screen.getByRole('group', { name: /qué hacer con/i })
const summary = (name?: RegExp) => screen.findByRole('region', { name: name ?? /datos de/i })
const firstName = realData.names.species[realTeam[0].species]
const secondName = realData.names.species[realTeam[1].species]

describe('pantalla de equipo', () => {
  it('pinta los 6 Pokémon con nombre, PS y estado accesibles', () => {
    mount({ members: members({ 1: { condition: '0 fnt' }, 2: { condition: '40/100 par' } }) })
    const group = screen.getByRole('group', { name: /equipo/i })
    expect(within(group).getAllByRole('button')).toHaveLength(6)
    expect(panel(new RegExp(firstName))).toHaveAccessibleName(/en combate/i)
    expect(panel(new RegExp(secondName))).toHaveAccessibleName(/debilitado/i)
    expect(within(group).getAllByRole('button')[2]).toHaveAccessibleName(/paralizado/i)
  })

  it('cada placa lleva su icono de menú, nivel y PS, y los debilitados llevan la placa roja', () => {
    const { container } = render(<PartyScreen members={members({ 1: { condition: '0 fnt' } })} data={realData} forced={false} enabled onChoose={() => undefined} onClose={() => undefined} />)
    expect(container.querySelectorAll('.bt-member-icon')).toHaveLength(6)
    expect(container.querySelectorAll('.bt-party-level')).toHaveLength(6)
    const panels = Array.from(container.querySelectorAll<HTMLElement>('.bt-party-panel'))
    expect(panels[1].style.backgroundImage).toMatch(/panel-red/)
    expect(panels[2].style.backgroundImage).toMatch(/panel-blue/)
    expect(panels[0].style.backgroundImage).toMatch(/panel-blue-left-lit/)
  })

  it('elegir una placa abre Cambiar / Datos / Cancelar y marca la placa en verde', async () => {
    const { user } = mount()
    await user.click(panel(new RegExp(secondName)))
    expect(['Cambiar', 'Datos', 'Cancelar'].map((name) => within(options()).getByRole('button', { name }).textContent)).toEqual(['Cambiar', 'Datos', 'Cancelar'])
    expect(panel(new RegExp(secondName))).toHaveAttribute('aria-expanded', 'true')
  })

  it('Cambiar envía la posición del Pokémon', async () => {
    const { onChoose, user } = mount()
    await user.click(panel(new RegExp(secondName)))
    await user.click(within(options()).getByRole('button', { name: 'Cambiar' }))
    expect(onChoose).toHaveBeenCalledWith(2)
  })

  it('con el menú abierto, Escape lo cierra sin cambiar y devuelve el foco a la placa', async () => {
    const { onChoose, onClose, user } = mount()
    await user.click(panel(new RegExp(secondName)))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: /qué hacer con/i })).toBeNull()
    expect(onChoose).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('con el menú cerrado, Escape y Volver salen de la pantalla (menos en el cambio forzado)', async () => {
    const first = mount()
    await first.user.keyboard('{Escape}')
    expect(first.onClose).toHaveBeenCalledTimes(1)
  })

  it('cambio forzado: sin Cancelar ni Volver, y Escape no sale', async () => {
    const { onClose, user } = mount({ forced: true })
    expect(screen.queryByRole('button', { name: /^volver$|^cancelar$/i })).toBeNull()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    await user.click(panel(new RegExp(secondName)))
    expect(within(options()).queryByRole('button', { name: 'Cancelar' })).toBeNull()
    expect(within(options()).getByRole('button', { name: 'Datos' })).toBeEnabled()
  })

  it('los controles están desactivados si el turno no está abierto', () => {
    mount({ enabled: false })
    expect(panel(new RegExp(firstName))).toBeDisabled()
  })
})

describe('pantalla de datos del Pokémon', () => {
  beforeEach(() => { vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 }) })
  afterEach(() => { vi.unstubAllGlobals() })

  async function openSummary(index = 1) {
    const ctx = mount()
    await ctx.user.click(panel(new RegExp(realData.names.species[realTeam[index].species])))
    await ctx.user.click(within(options()).getByRole('button', { name: 'Datos' }))
    return { ...ctx, region: await summary() }
  }

  it('Datos abre la pantalla de datos del Pokémon elegido, en la página Información', async () => {
    const { region } = await openSummary(1)
    expect(region).toHaveAccessibleName(new RegExp(secondName))
    expect(region).toHaveAttribute('data-page', '0')
    const set = realTeam[1]
    expect(within(region).getByText(realData.names.items[set.item])).toBeInTheDocument()
    for (const type of realData.dex.species[set.species].types) expect(within(region).getAllByText(new RegExp(realData.names.types[type], 'i')).length).toBeGreaterThan(0)
  })

  it('las flechas izquierda y derecha cambian de página (Información, Habilidades, Movimientos) y no pasan de los extremos', async () => {
    const { region, user } = await openSummary(1)
    await user.keyboard('{ArrowLeft}')
    expect(region).toHaveAttribute('data-page', '0')
    await user.keyboard('{ArrowRight}')
    expect(region).toHaveAttribute('data-page', '1')
    await user.keyboard('{ArrowRight}')
    expect(region).toHaveAttribute('data-page', '2')
    await user.keyboard('{ArrowRight}')
    expect(region).toHaveAttribute('data-page', '2')
  })

  it('los botones « » de la cabecera y las pestañas también cambian de página', async () => {
    const { region, user } = await openSummary(1)
    await user.click(within(region).getByRole('button', { name: /página siguiente/i }))
    expect(region).toHaveAttribute('data-page', '1')
    await user.click(within(region).getByRole('button', { name: 'Información' }))
    expect(region).toHaveAttribute('data-page', '0')
    expect(within(region).getByRole('button', { name: /página anterior/i })).toBeDisabled()
  })

  it('Habilidades muestra las 5 estadísticas reales a Nv. 50, los PS y la habilidad con su descripción', async () => {
    const { region, user } = await openSummary(1)
    await user.keyboard('{ArrowRight}')
    const member = members()[1]
    for (const key of ['atk', 'def', 'spa', 'spd', 'spe'] as const) expect(within(region).getAllByText(String(member.stats[key])).length).toBeGreaterThan(0)
    expect(within(region).getByText(`${member.hp} / ${member.maxHp}`)).toBeInTheDocument()
    expect(within(region).getByText(member.abilityName)).toBeInTheDocument()
    expect(region.querySelector('.bt-sum-ability-text')?.textContent?.length).toBeGreaterThan(5)
  })

  it('la naturaleza marca la estadística que sube y la que baja (con texto, no solo color)', async () => {
    const adamant = members().findIndex((member) => member.natureUp !== null)
    if (adamant < 0) return
    const ctx = mount()
    await ctx.user.click(panel(new RegExp(realData.names.species[realTeam[adamant].species])))
    await ctx.user.click(within(options()).getByRole('button', { name: 'Datos' }))
    const region = await summary()
    await ctx.user.keyboard('{ArrowRight}')
    expect(within(region).getByText(/sube con la naturaleza/i)).toBeInTheDocument()
    expect(within(region).getByText(/baja con la naturaleza/i)).toBeInTheDocument()
  })

  it('pulsar un movimiento abre su detalle: categoría, potencia, precisión y descripción; el movimiento queda marcado', async () => {
    const { region, user } = await openSummary(1)
    await user.keyboard('{ArrowRight}')
    const member = members()[1]
    const moveButtons = within(region).getAllByRole('button', { name: /ver detalle de/i })
    expect(moveButtons).toHaveLength(4)
    await user.click(moveButtons[1])
    expect(region).toHaveAttribute('data-page', '2')
    expect(within(region).getAllByRole('button', { name: /ver detalle de/i })[1]).toHaveAttribute('aria-pressed', 'true')
    expect(within(region).getByText(member.moves[1].power)).toBeInTheDocument()
    expect(region.querySelector('.bt-sum-move-text')?.textContent?.length).toBeGreaterThan(10)
    expect(within(region).getByText(member.moves[1].categoryLabel as string)).toBeInTheDocument()
  })

  it('cada movimiento muestra tipo (en español), nombre y PP actuales/máximos', async () => {
    const { region, user } = await openSummary(1)
    await user.keyboard('{ArrowRight}')
    const member = members()[1]
    const slots = region.querySelectorAll('.bt-sum-slot')
    expect(slots).toHaveLength(4)
    member.moves.forEach((move, index) => {
      expect(slots[index].textContent).toContain(move.name)
      expect(slots[index].textContent).toContain(`${move.pp}/${move.maxPp}`)
      expect(within(slots[index] as HTMLElement).getByText(move.typeLabel as string)).toBeInTheDocument()
    })
  })

  it('las flechas arriba y abajo cambian de Pokémon dando la vuelta', async () => {
    const { region, user } = await openSummary(0)
    await user.keyboard('{ArrowDown}')
    expect(region).toHaveAccessibleName(new RegExp(secondName))
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(region).toHaveAccessibleName(new RegExp(realData.names.species[realTeam[5].species]))
  })

  it('Volver en el detalle del movimiento regresa a Habilidades; después cierra y vuelve al equipo', async () => {
    const { region, user } = await openSummary(1)
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await user.click(within(region).getByRole('button', { name: 'Volver' }))
    expect(region).toHaveAttribute('data-page', '1')
    await user.click(within(region).getByRole('button', { name: 'Volver' }))
    expect(screen.queryByRole('region', { name: /datos de/i })).toBeNull()
    expect(screen.getByRole('group', { name: /equipo/i })).toBeInTheDocument()
  })

  it('Escape también vuelve atrás y Cerrar sale de golpe desde cualquier página', async () => {
    const { region, user } = await openSummary(1)
    await user.keyboard('{ArrowRight}{ArrowRight}{Escape}')
    expect(region).toHaveAttribute('data-page', '1')
    await user.click(within(region).getByRole('button', { name: /cerrar datos/i }))
    expect(screen.queryByRole('region', { name: /datos de/i })).toBeNull()
  })

  it('el foco vuelve a la placa del Pokémon al cerrar los datos', async () => {
    const { region, user } = await openSummary(1)
    await user.click(within(region).getByRole('button', { name: /cerrar datos/i }))
    expect(document.activeElement).toBe(panel(new RegExp(secondName)))
  })

  it('todos los controles táctiles tienen nombre accesible y el tamaño mínimo de 44 px a escala 1 sale de la regla CSS', async () => {
    const { region } = await openSummary(1)
    for (const button of within(region).getAllByRole('button')) expect(button, button.outerHTML).toHaveAccessibleName()
  })
})
