import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BattleScreen } from './BattleScreen'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { settle } from '../../test-utils/ui'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { SWITCH_DURATIONS_MS } from '../../hooks/useBattle'

// RF-72: animación de cambio de Pokémon (retirada con rayo rojo y envío con la Poké Ball de la intro), jugador y rival, voluntario y forzado.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-17', data)
const PLAYER_SWITCH = ['|switch|p1a: Starmie|Starmie, L50|150/150']
const RIVAL_SWITCH = ['|switch|p2a: Tyranitar|Tyranitar, L50|100/100']

function mount(animations: 'always' | 'system' | 'never' = 'always') {
  const client = mockClient()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<BattleScreen client={client as any} data={data} challenge={challenge} playerLead={0} battleSeed="seed-1" animations={animations} onFinish={vi.fn()} onExit={vi.fn()} />)
  return { client, user }
}
const attribute = () => screen.getByTestId('field').getAttribute('data-switch')
const message = () => screen.getByRole('status').textContent
const fight = () => screen.getByRole('button', { name: /luchar/i })
const step = (ms: number) => settle(ms)
async function afterIntro(animations: 'always' | 'system' | 'never' = 'always') {
  const context = mount(animations)
  context.client.emit(mkUpdate())
  await step(8000)
  return context
}
const afterSwitchView = (lines: string[], over: Parameters<typeof mkView>[0] = {}) =>
  mkUpdate({ lines: [...lines, '|turn|2'], view: mkView({ turn: 2, ...over }) })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('animación de cambio de Pokémon (RF-72)', () => {
  it('cambio voluntario del jugador: arranca la retirada, a los 0,5 s sale el nuevo con su texto y a los 1,6 s termina', async () => {
    const { client } = await afterIntro()
    expect(attribute()).toBeNull()
    client.emit(afterSwitchView(PLAYER_SWITCH, { pActive: 1 }))
    await step(100)
    expect(attribute()).toBe('player')
    expect(message()).not.toMatch(/Starmie/)
    await step(SWITCH_DURATIONS_MS.recall + 100)
    expect(message()).toMatch(/Adelante, Starmie/)
    expect(attribute()).toBe('player')
    await step(SWITCH_DURATIONS_MS.send + 100)
    expect(attribute()).toBeNull()
  })

  it('cambio del rival: la misma secuencia con el bando rival', async () => {
    const { client } = await afterIntro()
    client.emit(afterSwitchView(RIVAL_SWITCH, { rActive: 1 }))
    await step(100)
    expect(attribute()).toBe('rival')
    await step(SWITCH_DURATIONS_MS.recall + 200)
    expect(message()).toMatch(/Tyranitar/i)
    await step(SWITCH_DURATIONS_MS.send + 200)
    expect(attribute()).toBeNull()
  })

  it('cambio forzado tras un KO (el anterior está debilitado): no hay retirada, solo el envío', async () => {
    const { client } = await afterIntro()
    client.emit(afterSwitchView(['|faint|p1a: Garchomp', ...PLAYER_SWITCH], { pActive: 1, player: [pMon('garchomp', 0, 183), pMon('starmie', 150, 150), pMon('gengar', 140, 140)] }))
    await step(100)
    let seen = attribute()
    for (let elapsed = 0; elapsed < 4000 && seen !== 'player-send'; elapsed += 50) {
      await step(50)
      seen = attribute()
    }
    expect(seen).toBe('player-send')
  })

  it('el KO del rival y su sustituto: envío del rival sin retirada', async () => {
    const { client } = await afterIntro()
    client.emit(afterSwitchView(['|faint|p2a: Snorlax', ...RIVAL_SWITCH], { rActive: 1, rival: [rMon('snorlax', 0), rMon('tyranitar'), rMon('heatran')] }))
    let seen = attribute()
    for (let elapsed = 0; elapsed < 4000 && seen !== 'rival-send'; elapsed += 50) {
      await step(50)
      seen = attribute()
    }
    expect(seen).toBe('rival-send')
  })

  it('la táctil queda en espera mientras se anima y el menú reaparece al terminar: no bloquea el turno', async () => {
    const { client } = await afterIntro()
    client.emit(afterSwitchView(PLAYER_SWITCH, { pActive: 1 }))
    await step(300)
    expect(screen.queryByRole('button', { name: /luchar/i })).toBeNull()
    await step(4000)
    expect(attribute()).toBeNull()
    expect(fight()).toBeEnabled()
  })

  it('los mensajes siguen saliendo uno a uno y en el historial no se duplican', async () => {
    const { client, user } = await afterIntro()
    client.emit(afterSwitchView(PLAYER_SWITCH, { pActive: 1 }))
    await step(4000)
    await user.click(screen.getByRole('button', { name: /registro/i }))
    const log = screen.getByRole('log').textContent ?? ''
    expect((log.match(/Adelante/g) ?? []).length).toBe(2)
  })

  it('a x4 dura la cuarta parte', async () => {
    const { client, user } = await afterIntro()
    await user.click(screen.getByRole('button', { name: /velocidad/i }))
    await user.click(screen.getByRole('button', { name: /velocidad/i }))
    client.emit(afterSwitchView(PLAYER_SWITCH, { pActive: 1 }))
    await step(100)
    expect(attribute()).toBe('player')
    await step(((SWITCH_DURATIONS_MS.recall + SWITCH_DURATIONS_MS.send) / 4) + 300)
    expect(attribute()).toBeNull()
  })

  it('un toque en la caja de mensajes adelanta el texto del envío (no la retirada) y el turno se abre', async () => {
    const { client, user } = await afterIntro()
    client.emit(afterSwitchView(PLAYER_SWITCH, { pActive: 1 }))
    await step(SWITCH_DURATIONS_MS.recall + 100)
    await user.click(screen.getByRole('status'))
    await step(200)
    expect(attribute()).toBeNull()
  })

  it('arrastrar (Remolino, Rugido) no lleva animación de bola', async () => {
    const { client } = await afterIntro()
    client.emit(afterSwitchView(['|drag|p2a: Tyranitar|Tyranitar, L50|100/100'], { rActive: 1 }))
    await step(100)
    expect(attribute()).toBeNull()
  })

  it('con prefers-reduced-motion («Según el sistema») el guion es el mismo (el CSS solo hace fundidos)', async () => {
    const { mockMatchMedia } = await import('../../test-utils/ui')
    mockMatchMedia(true)
    const { client } = await afterIntro('system')
    client.emit(afterSwitchView(PLAYER_SWITCH, { pActive: 1 }))
    await step(100)
    expect(attribute()).toBe('player')
    expect(screen.getByTestId('battle-screen')).toHaveAttribute('data-reduced-motion', 'true')
  })

  it('el cambio no se anima en el primer update: lo cubre la intro', async () => {
    const { client } = mount()
    client.emit(mkUpdate({ lines: ['|switch|p1a: Garchomp|Garchomp, L50|183/183', '|switch|p2a: Snorlax|Snorlax, L50|100/100'] }))
    for (let elapsed = 0; elapsed < 8000; elapsed += 100) {
      expect(attribute()).toBeNull()
      await step(100)
    }
  })
})
