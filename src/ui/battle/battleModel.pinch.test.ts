import { describe, expect, it } from 'vitest'
import type { BattleView } from '../../battle/protocol'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { fillFor, playerInPinch } from './battleModel'

// UT-80 · Pitido de vida baja (DEC-57): solo con el Pokémon activo del jugador en rojo y en pie.
describe('playerInPinch', () => {
  const view = (over: Parameters<typeof mkView>[0]) => mkView(over) as BattleView

  it('suena con el activo del jugador en rojo (20 % o menos), no en amarillo ni en verde', () => {
    expect(playerInPinch(view({ player: [pMon('garchomp', 30, 183)] }))).toBe(true)
    expect(playerInPinch(view({ player: [pMon('garchomp', 40, 183)] }))).toBe(false)
    expect(playerInPinch(view({ player: [pMon('garchomp', 183, 183)] }))).toBe(false)
    expect([fillFor(21), fillFor(20), fillFor(51)]).toEqual(['yellow', 'red', 'green'])
  })

  it('nunca por el rival en rojo', () => {
    expect(playerInPinch(view({ rival: [rMon('snorlax', 5)] }))).toBe(false)
  })

  it('se corta al debilitarse (PS a 0, antes de la línea faint) y con otro activo en pie', () => {
    expect(playerInPinch(view({ player: [pMon('garchomp', 0, 183, { fainted: false })] }))).toBe(false)
    expect(playerInPinch(view({ player: [pMon('garchomp', 0, 183)] }))).toBe(false)
    expect(playerInPinch(view({ player: [pMon('garchomp', 10, 183), pMon('starmie', 150, 150)], pActive: 1 }))).toBe(false)
    expect(playerInPinch(null)).toBe(false)
  })
})
