import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BattleScreen } from './BattleScreen'
import { getDailyChallenge } from '../../core/challenge'
import { emptyFieldState, type FieldState } from '../../battle/fieldState'
import { makeGameData } from '../../test-utils/fixtures'
import { loadGameData } from '../../data/gameData'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { settle } from '../../test-utils/ui'
import { cardNote, effectLabel, effectsSentence, isCompact, rowNote } from './fieldText'

// UT-144 · Pastilla y pantalla «Estado» (RF-44b, DEC-78).
// Los nombres reales: la partida de prueba no trae los de estos movimientos.
const names = loadGameData().names
const data = { ...makeGameData(), names }
const challenge = getDailyChallenge('2026-10-17', data)
const SIX = ['garchomp', 'starmie', 'gengar', 'tyranitar', 'heatran', 'milotic']
const RSIX = ['snorlax', 'tyranitar', 'heatran', 'lapras', 'starmie', 'gyarados']
const view = (field: Partial<FieldState> = {}, weather: string | null = null) =>
  ({ ...mkView({ player: SIX.map((s) => pMon(s, 150, 150)), rival: RSIX.map((s) => rMon(s)), weather }), field: { ...emptyFieldState(), ...field } })

function mount(mode?: 'replay') {
  const client = mockClient()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(
    <BattleScreen client={client as never} data={data} challenge={challenge} playerLead={0} battleSeed="seed-1" mode={mode} controls={mode ? () => null : undefined} onFinish={vi.fn()} onExit={vi.fn()} />,
  )
  return { client, user }
}

async function openStatus(field: Partial<FieldState> = {}, weather: string | null = null) {
  const m = mount()
  m.client.emit(mkUpdate({ view: view(field, weather) }))
  await settle()
  await m.user.click(screen.getByTestId('weather'))
  return { ...m, panel: screen.getByRole('region', { name: 'Estado del combate' }) }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('textos de la pantalla «Estado» (UT-144)', () => {
  it('nombres en español (del movimiento, propios y con capas) y frases para la caja de mensajes', () => {
    expect(effectLabel({ id: 'spikes', turns: null, layers: 2 }, names)).toBe(`${names.moves.spikes} ×2`)
    expect(effectLabel({ id: 'confusion', turns: null }, names)).toBe('Confusión')
    expect(effectLabel({ id: 'tailwind', turns: 3 }, names)).toBe(names.moves.tailwind)
    expect(effectsSentence([{ id: 'tailwind', turns: 3 }, { id: 'reflect', turns: 1 }, { id: 'stealthrock', turns: null }], names))
      .toBe(`${names.moves.tailwind} (3 turnos), ${names.moves.reflect} (1) y ${names.moves.stealthrock}`)
    expect(rowNote('Tu lado', [{ id: 'reflect', turns: 1 }], names)).toBe(`Tu lado: ${names.moves.reflect} (1 turno).`)
    expect(rowNote('Campo', [], names)).toBe('Campo: Nada.')
    expect(cardNote('Pinsir', { boosts: { atk: 2, spe: -1 }, effects: [{ id: 'substitute', turns: null }] }, names))
      .toBe(`Pinsir: Ataque +2 y Velocidad −1. ${names.moves.substitute}.`)
    expect(cardNote('Pinsir', { boosts: {}, effects: [] }, names)).toBe('Pinsir: Sin cambios.')
  })

  it('modo compacto con más de 4 líneas (una por estadística y una por efecto)', () => {
    expect(isCompact({ boosts: { atk: 1, def: 1 }, effects: [{ id: 'taunt', turns: 2 }, { id: 'substitute', turns: null }] })).toBe(false)
    expect(isCompact({ boosts: { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, effects: [] })).toBe(true)
  })
})

describe('pastilla y pantalla «Estado» en el combate (UT-144)', () => {
  it('sin clima, la pastilla dice «Estado» y abre la pantalla: los dos Pokémon «Sin cambios» y las tres franjas con «Nada»', async () => {
    const { panel, user } = await openStatus()
    expect(screen.getByTestId('weather')).toHaveAttribute('data-weather', 'none')
    expect(screen.getByTestId('weather')).toHaveTextContent(/^Estado/)
    expect(within(panel).getAllByText('Sin cambios')).toHaveLength(2)
    expect(within(panel).getAllByText('Nada')).toHaveLength(3)
    expect(within(panel).getByRole('button', { name: /^Garchomp \(tu Pokémon\)/ })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /^Snorlax \(rival\)/ })).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Volver' }))
    expect(screen.queryByRole('region', { name: 'Estado del combate' })).toBeNull()
    expect(screen.getByRole('button', { name: /luchar/i })).toBeInTheDocument()
  })

  it('con clima, la pastilla sigue igual; las subidas van con una flecha por nivel y los efectos con sus turnos', async () => {
    const { panel } = await openStatus({
      field: [{ id: 'trickroom', turns: 2 }],
      player: [{ id: 'tailwind', turns: 3 }],
      rival: [{ id: 'spikes', turns: null, layers: 2 }],
      playerActive: { boosts: { atk: 2, spe: -1 }, effects: [{ id: 'taunt', turns: 2 }] },
    }, 'raindance')
    expect(screen.getByTestId('weather')).toHaveTextContent(/^Lluvia/)
    const mine = within(panel).getByRole('button', { name: /tu Pokémon/ })
    expect(mine).not.toHaveClass('bt-status-compact')
    const attack = within(mine).getByText('Ataque').parentElement!
    expect(attack.querySelectorAll('.bt-arrow-up')).toHaveLength(2)
    expect(within(mine).getByText('Velocidad').parentElement!.querySelectorAll('.bt-arrow-down')).toHaveLength(1)
    expect(within(mine).getByText(names.moves.taunt).parentElement).toHaveTextContent(`${names.moves.taunt}2`)
    expect(within(panel).getByRole('button', { name: /^Campo/ })).toHaveTextContent(`CAMPO${names.moves.trickroom}2`)
    expect(within(panel).getByRole('button', { name: /^Lado rival/ })).toHaveTextContent(`${names.moves.spikes} ×2`)
  })

  it('compacto: estadísticas abreviadas en dos columnas, más de 3 niveles con flecha y número, y los efectos en una línea', async () => {
    const { panel } = await openStatus({
      rivalActive: { boosts: { atk: -2, def: 6, spa: 3, spd: 1, spe: -1 }, effects: [{ id: 'confusion', turns: null }, { id: 'taunt', turns: 2 }] },
    })
    const rival = within(panel).getByRole('button', { name: /rival\)/ })
    expect(rival).toHaveClass('bt-status-compact')
    expect(within(rival).getByText('Def').parentElement!.querySelectorAll('.bt-arrow-up')).toHaveLength(1)
    expect(within(rival).getByText('Def').parentElement).toHaveTextContent('Def6')
    expect(within(rival).getByText('AtE').parentElement!.querySelectorAll('.bt-arrow-up')).toHaveLength(3)
    expect(within(rival).getByText(`Confusión · ${names.moves.taunt}`)).toBeInTheDocument()
  })

  it('al pulsar una franja o una ficha, el detalle completo sale en la caja de mensajes', async () => {
    const { panel, user } = await openStatus({ player: [{ id: 'tailwind', turns: 3 }, { id: 'reflect', turns: 4 }, { id: 'lightscreen', turns: 2 }] })
    await user.click(within(panel).getByRole('button', { name: /^Tu lado/ }))
    expect(screen.getByRole('status')).toHaveTextContent(`Tu lado: ${names.moves.tailwind} (3 turnos), ${names.moves.reflect} (4) y ${names.moves.lightscreen} (2).`)
    await user.click(within(panel).getByRole('button', { name: /^Snorlax/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Snorlax: Sin cambios.')
  })

  it('en el visor de repeticiones también: la pastilla abre la pantalla con la vista del paso', async () => {
    const m = mount('replay')
    m.client.emit(mkUpdate({ view: view({ playerActive: { boosts: { spe: 1 }, effects: [] } }), request: null }))
    await settle()
    await m.user.click(screen.getByTestId('weather'))
    const panel = screen.getByRole('region', { name: 'Estado del combate' })
    expect(within(panel).getByText('Velocidad')).toBeInTheDocument()
    await m.user.click(within(panel).getByRole('button', { name: 'Volver' }))
    expect(screen.queryByRole('region', { name: 'Estado del combate' })).toBeNull()
  })
})
