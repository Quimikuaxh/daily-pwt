import { describe, expect, it } from 'vitest'
import type { BattleView } from '../../battle/protocol'
import { mkView, pMon, rMon } from '../../test-utils/view'
import { fillFor, lastPokemonThemeOn, playerInPinch, rivalOnLastPokemon } from './battleModel'

// UT-80 · Música de vida baja (antes, pitido; DEC-57): solo con el Pokémon activo del jugador en rojo y en pie.
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

// UT-122 · Tema del último Pokémon del rival (decisión de Jose, 30/10/2026).
describe('rivalOnLastPokemon', () => {
  const view = (over: Parameters<typeof mkView>[0]) => mkView(over) as BattleView
  const fainted = (id: string) => rMon(id, 0)

  it('con el último Pokémon del rival en el campo y en pie, sí; con más de uno en pie, no', () => {
    expect(rivalOnLastPokemon(view({ rival: [fainted('snorlax'), fainted('lapras'), rMon('gyarados', 80)], rActive: 2 }))).toBe(true)
    expect(rivalOnLastPokemon(view({ rival: [rMon('snorlax', 40), rMon('lapras'), rMon('gyarados')] }))).toBe(false)
  })

  it('mientras cae el penúltimo y aún no ha salido el último, no; tampoco al caer el último, ni sin vista', () => {
    expect(rivalOnLastPokemon(view({ rival: [fainted('snorlax'), rMon('gyarados')], rActive: 0 }))).toBe(false)
    expect(rivalOnLastPokemon(view({ rival: [fainted('snorlax'), fainted('gyarados')], rActive: 1 }))).toBe(false)
    expect(rivalOnLastPokemon(null)).toBe(false)
  })
})

// UT-127 · Cambio de requisito (Jose, 30/10/2026): al caer el último Pokémon del rival sigue su tema, no vuelve el del rival.
describe('lastPokemonThemeOn', () => {
  const view = (over: Parameters<typeof mkView>[0]) => mkView(over) as BattleView
  const fainted = (id: string) => rMon(id, 0)

  it('con el último en el campo y también cuando cae; con más de uno en pie, mientras sale el último o sin vista, no', () => {
    expect(lastPokemonThemeOn(view({ rival: [fainted('snorlax'), rMon('gyarados', 80)], rActive: 1 }))).toBe(true)
    expect(lastPokemonThemeOn(view({ rival: [fainted('snorlax'), fainted('gyarados')], rActive: 1 }))).toBe(true)
    expect(lastPokemonThemeOn(view({ rival: [rMon('snorlax', 40), rMon('gyarados')] }))).toBe(false)
    expect(lastPokemonThemeOn(view({ rival: [fainted('snorlax'), rMon('gyarados')], rActive: 0 }))).toBe(false)
    expect(lastPokemonThemeOn(null)).toBe(false)
  })
})
