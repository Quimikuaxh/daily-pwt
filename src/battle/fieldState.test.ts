import { describe, expect, it } from 'vitest'
import { createBattleEngine } from './engine'
import { applyFieldLine, emptyFieldState } from './fieldState'
import { viewReducer } from './viewReducer'
import { harmlessTeam, mon } from '../test-utils/teams'

// UT-143 · Pantalla «Estado» (RF-44b, DEC-78): lo que calcula el motor y cómo lo sigue el reductor línea a línea.
const make = (player: ReturnType<typeof harmlessTeam>, rival: ReturnType<typeof harmlessTeam>) =>
  createBattleEngine({ battleSeed: 'campo', player, rival, ai: 'trivial', maxTurns: 300 } as never)
const move = (slot: number) => ({ type: 'move' as const, slot })

describe('estado del campo (UT-143)', () => {
  it('el motor da los efectos del campo y de cada lado con sus turnos y capas, y las subidas de cada Pokémon', () => {
    const player = [mon('mew', ['trickroom', 'reflect', 'spikes', 'swordsdance']), ...harmlessTeam().slice(1)]
    const rival = [mon('mew', ['tailwind', 'splash', 'splash', 'splash']), ...harmlessTeam().slice(1)]
    const engine = make(player, rival)
    expect(engine.start().view.field).toEqual(emptyFieldState())

    const first = engine.choose(move(1)).view.field!
    expect(first.field).toEqual([{ id: 'trickroom', turns: 4 }])
    expect(first.rival).toEqual([{ id: 'tailwind', turns: 3 }])

    // Espacio Raro dura 5 turnos con el que se usa: al acabar ese, quedan 4.
    expect(engine.choose(move(2)).view.field!.player).toEqual([{ id: 'reflect', turns: 4 }])
    engine.choose(move(3))
    const last = engine.choose(move(3)).view.field!
    expect(last.player).toEqual([{ id: 'reflect', turns: 2 }])
    expect(last.rival).toEqual([{ id: 'spikes', turns: null, layers: 2 }])
    expect(last.field).toEqual([{ id: 'trickroom', turns: 1 }])

    // Al acabarse, Espacio Raro sale de la lista y el rival vuelve a poner Viento Afín.
    const boosted = engine.choose(move(4)).view.field!
    expect(boosted.field).toEqual([])
    expect(boosted.rival).toEqual([{ id: 'tailwind', turns: 3 }, { id: 'spikes', turns: null, layers: 2 }])
    expect(boosted.playerActive.boosts).toEqual({ atk: 2 })
    expect(boosted.rivalActive).toEqual({ boosts: {}, effects: [] })
  })

  it('los efectos del Pokémon: los que caducan con turnos (Mofa, Canto Mortal), los demás sin ellos (Drenadoras, Sustituto)', () => {
    const player = [mon('mew', ['substitute', 'splash', 'splash', 'splash']), ...harmlessTeam().slice(1)]
    const engine = make(player, [mon('mew', ['leechseed', 'splash', 'splash', 'splash']), ...harmlessTeam().slice(1)])
    engine.start()
    expect(engine.choose(move(1)).view.field!.playerActive.effects).toEqual([{ id: 'substitute', turns: null }, { id: 'leechseed', turns: null }])

    const taunted = make([mon('mew', ['splash', 'splash', 'splash', 'splash']), ...harmlessTeam().slice(1)], [mon('mew', ['taunt', 'splash', 'splash', 'splash']), ...harmlessTeam().slice(1)])
    taunted.start()
    const [effect] = taunted.choose(move(1)).view.field!.playerActive.effects
    expect(effect.id).toBe('taunt')
    expect(effect.turns).toBeGreaterThan(0)

    const perish = make([mon('mew', ['perishsong', 'splash', 'splash', 'splash']), ...harmlessTeam().slice(1)], harmlessTeam())
    perish.start()
    const after = perish.choose(move(1))
    expect(after.view.field!.playerActive.effects).toEqual([{ id: 'perishsong', turns: 3 }])
    expect(after.view.field!.rivalActive.effects).toEqual([{ id: 'perishsong', turns: 3 }])
  })

  it('el reductor sigue el registro: subidas, bajadas, efectos que empiezan y acaban; al cambiar se vacía ese lado', () => {
    const state = emptyFieldState()
    for (const line of [
      '|-boost|p1a: mew|atk|2', '|-unboost|p2a: zebstrika|spe|1', '|-boost|p1a: mew|atk|6', '|-fieldstart|move: Trick Room|[of] p1a: mew',
      '|-sidestart|p2: Rival|Spikes', '|-sidestart|p2: Rival|Spikes', '|-sidestart|p1: Jugador|move: Reflect', '|-start|p2a: zebstrika|confusion',
      '|-start|p2a: zebstrika|perish3', '|-start|p2a: zebstrika|move: Taunt',
    ]) applyFieldLine(state, line)
    expect(state.playerActive.boosts).toEqual({ atk: 6 })
    expect(state.rivalActive.boosts).toEqual({ spe: -1 })
    expect(state.field).toEqual([{ id: 'trickroom', turns: null }])
    expect(state.rival).toEqual([{ id: 'spikes', turns: null, layers: 2 }])
    expect(state.player).toEqual([{ id: 'reflect', turns: null }])
    expect(state.rivalActive.effects).toEqual([{ id: 'confusion', turns: null }, { id: 'taunt', turns: null }, { id: 'perishsong', turns: 3 }])

    for (const line of ['|-end|p2a: zebstrika|confusion', '|-fieldend|move: Trick Room', '|-sideend|p1: Jugador|Reflect', '|-clearnegativeboost|p2a: zebstrika']) applyFieldLine(state, line)
    expect(state.rivalActive).toEqual({ boosts: {}, effects: [{ id: 'taunt', turns: null }, { id: 'perishsong', turns: 3 }] })
    expect([state.field, state.player]).toEqual([[], []])

    applyFieldLine(state, '|switch|p2a: snorlax|Snorlax, L50|100/100')
    expect(state.rivalActive).toEqual({ boosts: {}, effects: [] })
    expect(state.playerActive.boosts).toEqual({ atk: 6 })
  })

  it('viewReducer lo aplica sobre la vista y la instantánea manda (vistas sin campo, como las de antes, no cambian)', () => {
    const base = { turn: 1, weather: null, player: { remaining: 6, active: 0, team: [] }, rival: { remaining: 6, active: 0, team: [] } }
    const withField = viewReducer({ ...base, field: emptyFieldState() }, { type: 'lines', lines: ['|-boost|p1a: mew|def|1'] })
    expect(withField.field!.playerActive.boosts).toEqual({ def: 1 })
    expect(viewReducer(base, { type: 'lines', lines: ['|-boost|p1a: mew|def|1'] }).field).toBeUndefined()
  })
})
