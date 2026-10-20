import { describe, it, expect, vi } from 'vitest'
import { evaluateEnd, forfeitBattle } from './end'

// UT-50 · RF-55/56 · DEC-14. Lógica pura de fin de combate.
// TODO-CONTRATO (src/battle/end.ts):
//   evaluateEnd(s: { ended: boolean; winner: 'player' | 'rival' | 'tie' | null; turn: number; playerAlive: number; rivalFainted: number; forfeited?: boolean }, maxTurns: number)
//     -> null (sigue) | { result: 'win' | 'loss'; reason: 'faint' | 'forfeit' | 'turnLimit' | 'tie'; turns: number; playerAlive: number; rivalFainted: number }
//   forfeitBattle(battle: { lose(side: 'p1'): void }): void   (rendirse = battle.lose('p1'); `forfeit` no existe en el sim)
const base = { ended: false, winner: null, turn: 1, playerAlive: 6, rivalFainted: 0 } as const

describe('evaluateEnd', () => {
  it('el turno 300 sigue en juego', () => {
    expect(evaluateEnd({ ...base, turn: 300 }, 300)).toBeNull()
  })

  it('el turno 301 termina por límite de turnos', () => {
    expect(evaluateEnd({ ...base, turn: 301 }, 300)).toMatchObject({ reason: 'turnLimit' })
  })

  it('el límite de turnos cuenta como derrota', () => {
    expect(evaluateEnd({ ...base, turn: 301 }, 300)).toMatchObject({ result: 'loss' })
  })

  it('el turno 1 de una partida normal sigue', () => {
    expect(evaluateEnd(base, 300)).toBeNull()
  })

  it('un maxTurns pequeño se respeta (turn 4 con maxTurns 3)', () => {
    expect(evaluateEnd({ ...base, turn: 4 }, 3)).toMatchObject({ reason: 'turnLimit' })
  })

  it('un maxTurns pequeño: turn 3 con maxTurns 3 sigue', () => {
    expect(evaluateEnd({ ...base, turn: 3 }, 3)).toBeNull()
  })

  it('gana el jugador al debilitar a los 6 rivales', () => {
    expect(evaluateEnd({ ...base, ended: true, winner: 'player', turn: 20, playerAlive: 2, rivalFainted: 6 }, 300))
      .toEqual({ result: 'win', reason: 'faint', turns: 20, playerAlive: 2, rivalFainted: 6 })
  })

  it('pierde el jugador si el rival debilita a los suyos', () => {
    expect(evaluateEnd({ ...base, ended: true, winner: 'rival', turn: 15, playerAlive: 0, rivalFainted: 4 }, 300))
      .toEqual({ result: 'loss', reason: 'faint', turns: 15, playerAlive: 0, rivalFainted: 4 })
  })

  it('el empate cuenta como derrota', () => {
    expect(evaluateEnd({ ...base, ended: true, winner: 'tie', turn: 9, playerAlive: 0, rivalFainted: 6 }, 300))
      .toMatchObject({ result: 'loss', reason: 'tie' })
  })

  it('la rendición es derrota por rendición', () => {
    expect(evaluateEnd({ ...base, ended: true, winner: 'rival', forfeited: true, turn: 3, playerAlive: 6 }, 300))
      .toMatchObject({ result: 'loss', reason: 'forfeit' })
  })

  it('la rendición manda sobre un turno pasado del límite', () => {
    expect(evaluateEnd({ ...base, ended: true, winner: 'rival', forfeited: true, turn: 400 }, 300)).toMatchObject({ reason: 'forfeit' })
  })

  it('una victoria en el turno 301 sigue siendo victoria (el combate ya había terminado)', () => {
    expect(evaluateEnd({ ...base, ended: true, winner: 'player', turn: 301, rivalFainted: 6 }, 300)).toMatchObject({ result: 'win' })
  })

  it('conserva playerAlive y rivalFainted en el límite de turnos', () => {
    expect(evaluateEnd({ ...base, turn: 301, playerAlive: 3, rivalFainted: 2 }, 300)).toMatchObject({ playerAlive: 3, rivalFainted: 2 })
  })
})

describe('forfeitBattle', () => {
  it('rendirse llama a battle.lose("p1")', () => {
    const lose = vi.fn()
    forfeitBattle({ lose } as any)
    expect(lose).toHaveBeenCalledWith('p1')
  })

  it('rendirse llama a lose una sola vez', () => {
    const lose = vi.fn()
    forfeitBattle({ lose } as any)
    expect(lose).toHaveBeenCalledTimes(1)
  })
})
