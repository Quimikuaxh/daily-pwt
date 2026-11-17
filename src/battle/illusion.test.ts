import { describe, expect, it } from 'vitest'
import { createBattleEngine } from './engine'
import { presentedActive, presentedActiveIndex } from './presented'
import type { SideView } from './protocol'
import { attackers, mon } from '../test-utils/teams'

// UT-243 (Jose, 17/11/2026): con Ilusión, el combate presenta al último del equipo en los dos bandos; los PS y Datos son del real.
describe('Ilusión (UT-243)', () => {
  const zoroark = (moves: [string, string, string, string]) => mon('zoroark', moves, { ability: 'illusion' })
  const start = () => createBattleEngine({
    battleSeed: 'ilusion', ai: 'trivial', maxTurns: 50,
    player: [zoroark(['nightdaze', 'nightdaze', 'nightdaze', 'nightdaze']), ...attackers().slice(1)],
    rival: [zoroark(['nastyplot', 'nastyplot', 'nastyplot', 'nastyplot']), ...attackers().slice(1)],
  } as never)

  it('el registro llega disfrazado y la vista marca a quién imita el activo de cada bando', () => {
    const first = start().start()
    expect(first.lines.filter((line) => line.startsWith('|switch|'))).toEqual([
      expect.stringMatching(/^\|switch\|p1a: scizor\|Scizor/), expect.stringMatching(/^\|switch\|p2a: scizor\|Scizor/),
    ])
    for (const side of [first.view!.player, first.view!.rival]) {
      expect([side.active, side.team[0].species, side.team[0].illusion]).toEqual([0, 'zoroark', 5])
      expect(presentedActive(side)?.species).toBe('scizor')
      expect(presentedActiveIndex(side)).toBe(5)
    }
  })

  it('al recibir un golpe directo se rompe la Ilusión y el activo vuelve a verse como es', () => {
    const engine = start()
    engine.start()
    const after = engine.choose({ type: 'move', slot: 1 })
    // Noche Aciaga del jugador golpea al Zoroark rival: su Ilusión se rompe; la del jugador sigue (el rival solo usa Maquinación).
    expect(after.lines.some((line) => /^\|replace\|p2a: zoroark\|Zoroark/i.test(line))).toBe(true)
    expect(after.view!.rival.team[0].illusion).toBeUndefined()
    expect(presentedActive(after.view!.rival)?.species).toBe('zoroark')
    expect(after.view!.player.team[0].illusion).toBe(5)
  })

  it('sin Ilusión, el activo presentado es el real', () => {
    const side: SideView = { remaining: 1, active: 0, team: [{ species: 'pikachu', hpPercent: 100, status: null, fainted: false }] }
    expect([presentedActive(side)?.species, presentedActiveIndex(side)]).toEqual(['pikachu', 0])
    expect(presentedActive({ active: null, team: [] })).toBeNull()
  })
})
