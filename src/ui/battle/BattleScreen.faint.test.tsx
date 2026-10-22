import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BattleScreen } from './BattleScreen'
import { getDailyChallenge } from '../../core/challenge'
import { makeGameData } from '../../test-utils/fixtures'
import { mkUpdate, mockClient } from '../../test-utils/clientMock'
import { settle } from '../../test-utils/ui'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { HP_BAR_ANIMATION_MS } from '../../hooks/useBattle'

// DEC-42: orden de un debilitado: barra de PS a 0 -> mensaje «se ha debilitado» -> el sprite cae.
const data = makeGameData()
const challenge = getDailyChallenge('2026-10-17', data)
const message = () => screen.getByRole('status').textContent
const rivalSprite = () => screen.getByTestId('field').querySelector('.bt-mon-rival')!.getAttribute('data-fainted')
const playerSprite = () => screen.getByTestId('field').querySelector('.bt-mon-player')!.getAttribute('data-fainted')

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

async function afterIntro() {
  const client = mockClient()
  render(<BattleScreen client={client as any} data={data} challenge={challenge} playerLead={0} battleSeed="seed-1" onFinish={vi.fn()} onExit={vi.fn()} />)
  client.emit(mkUpdate())
  await settle(8000)
  return client
}

const finalView = () => mkView({ turn: 2, rival: [rMon('snorlax', 0), rMon('tyranitar'), rMon('heatran')], player: [pMon('garchomp', 0, 183), pMon('starmie'), pMon('gengar')] })

describe.each([
  ['rival', 'p2a: Snorlax', rivalSprite],
  ['jugador', 'p1a: Garchomp', playerSprite],
] as const)('debilitado del %s (DEC-42)', (_, target, spriteFainted) => {
  it('el sprite sigue en pie mientras baja la barra y el mensaje no sale hasta que la barra acaba; luego mensaje y, después, el sprite cae', async () => {
    const client = await afterIntro()
    client.emit(mkUpdate({ view: finalView(), lines: [`|-damage|${target}|0 fnt`, `|faint|${target}`, '|turn|2'] }))
    await settle(100)
    expect(spriteFainted(), 'golpe letal: aún en pie').toBe('false')
    await settle(HP_BAR_ANIMATION_MS - 300)
    expect(spriteFainted(), 'la barra aún baja: en pie').toBe('false')
    expect(message()).not.toMatch(/debilitado/)
    await settle(500)
    expect(message(), 'barra terminada: sale el mensaje').toMatch(/debilitado/)
    expect(spriteFainted(), 'mensaje en pantalla, sprite aún en pie').toBe('false')
    await settle(500)
    expect(spriteFainted(), 'tras el mensaje cae').toBe('true')
  })
})
