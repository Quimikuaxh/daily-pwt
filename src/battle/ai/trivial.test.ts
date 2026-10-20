import { describe, it, expect } from 'vitest'
import { chooseTrivialAction } from './trivial'
import { mkPsMove, mkRequest, mkSidePokemon } from '../../test-utils/requests'

// UT-43 · IA trivial (e2e y jugador de prueba de INT-01).
// TODO-CONTRATO: chooseTrivialAction(request: PsRequest): Choice, con Choice = { type: 'move' | 'switch'; slot: number } (slot 1-based).
describe('chooseTrivialAction', () => {
  it('elige el primer movimiento habilitado', () => {
    expect(chooseTrivialAction(mkRequest({}) as any)).toEqual({ type: 'move', slot: 1 })
  })

  it('salta los movimientos deshabilitados', () => {
    const moves = [mkPsMove('a', 'A', { disabled: true }), mkPsMove('b', 'B', { disabled: true }), mkPsMove('c', 'C'), mkPsMove('d', 'D')]
    expect(chooseTrivialAction(mkRequest({ moves }) as any)).toEqual({ type: 'move', slot: 3 })
  })

  it('salta los movimientos sin PP', () => {
    const moves = [mkPsMove('a', 'A', { pp: 0 }), mkPsMove('b', 'B'), mkPsMove('c', 'C'), mkPsMove('d', 'D')]
    expect(chooseTrivialAction(mkRequest({ moves }) as any)).toEqual({ type: 'move', slot: 2 })
  })

  it('con un solo movimiento habilitado (el último) lo elige', () => {
    const moves = [mkPsMove('a', 'A', { disabled: true }), mkPsMove('b', 'B', { disabled: true }), mkPsMove('c', 'C', { disabled: true }), mkPsMove('d', 'D')]
    expect(chooseTrivialAction(mkRequest({ moves }) as any)).toEqual({ type: 'move', slot: 4 })
  })

  it('con Forcejeo como único movimiento elige el slot 1', () => {
    const moves = [{ move: 'Struggle', id: 'struggle' }]
    expect(chooseTrivialAction(mkRequest({ moves }) as any)).toEqual({ type: 'move', slot: 1 })
  })

  it('con todos deshabilitados devuelve el slot 1 (el sim lo convertirá en Forcejeo) sin lanzar', () => {
    const moves = ['a', 'b', 'c', 'd'].map((x) => mkPsMove(x, x.toUpperCase(), { disabled: true }))
    expect(chooseTrivialAction(mkRequest({ moves }) as any)).toEqual({ type: 'move', slot: 1 })
  })

  it('ante forceSwitch elige el primer Pokémon vivo que no es el activo', () => {
    const side = [mkSidePokemon('A', { active: true, fainted: true }), mkSidePokemon('B', { fainted: true }), mkSidePokemon('C'), mkSidePokemon('D')]
    expect(chooseTrivialAction(mkRequest({ forceSwitch: true, side }) as any)).toEqual({ type: 'switch', slot: 3 })
  })

  it('ante forceSwitch con un único vivo en la última posición lo elige', () => {
    const side = [mkSidePokemon('A', { active: true, fainted: true }), mkSidePokemon('B', { fainted: true }), mkSidePokemon('C', { fainted: true }), mkSidePokemon('D')]
    expect(chooseTrivialAction(mkRequest({ forceSwitch: true, side }) as any)).toEqual({ type: 'switch', slot: 4 })
  })

  it('el slot de switch sigue el orden de request.side.pokemon (ya reordenado por el sim)', () => {
    const side = [mkSidePokemon('Activo', { active: true, fainted: true }), mkSidePokemon('Segundo')]
    expect(chooseTrivialAction(mkRequest({ forceSwitch: true, side }) as any).slot).toBe(2)
  })

  it('nunca devuelve una elección inválida en 50 requests variados', () => {
    const bad: number[] = []
    for (let i = 0; i < 50; i++) {
      const moves = [0, 1, 2, 3].map((k) => mkPsMove('m' + k, 'M' + k, { disabled: (i >> k) % 2 === 1 }))
      const c = chooseTrivialAction(mkRequest({ moves }) as any)
      const ok = c.type === 'move' && c.slot >= 1 && c.slot <= 4 && (!moves[c.slot - 1].disabled || moves.every((m) => m.disabled))
      if (!ok) bad.push(i)
    }
    expect(bad).toEqual([])
  })
})
