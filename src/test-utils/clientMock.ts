import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { mkRequest, mkPsMove, mkSidePokemon, type PsRequest } from './requests'
import { mkView, type BattleView } from './view'

/**
 * Cliente de combate simulado (sustituye al Worker). Contrato asumido (TODO-CONTRATO, src/battle/client.ts):
 *   interface BattleClient {
 *     init(init: { battleSeed: string; player: ResolvedSet[]; playerLead: number; rival: ResolvedSet[]; ai: 'heuristic' | 'trivial'; maxTurns: number }): void
 *     choose(choice: { type: 'move' | 'switch'; slot: number }): void
 *     forfeit(): void
 *     subscribe(listener: (msg: ClientMessage) => void): () => void      // devuelve la función para desuscribirse
 *     terminate(): void
 *   }
 *   ClientMessage = { type: 'update'; lines: string[]; view: BattleView; request: PsRequest | null; ended?: EngineEnd } | { type: 'error'; message: string }
 */
export type ClientMessage =
  | { type: 'update'; lines: string[]; view: BattleView; request: PsRequest | null; ended?: any }
  | { type: 'error'; message: string }

export function mockClient() {
  const listeners = new Set<(m: ClientMessage) => void>()
  return {
    init: vi.fn(),
    choose: vi.fn(),
    forfeit: vi.fn(),
    terminate: vi.fn(),
    subscribe: vi.fn((l: (m: ClientMessage) => void) => {
      listeners.add(l)
      return () => { listeners.delete(l) }
    }),
    /** Emite un mensaje del worker dentro de act. */
    emit(msg: ClientMessage) {
      act(() => { listeners.forEach((l) => l(msg)) })
    },
    listenerCount: () => listeners.size,
  }
}
export type MockClient = ReturnType<typeof mockClient>

/** Movimientos del activo en el request de los tests de UI. */
export const MOVES = [
  mkPsMove('earthquake', 'Earthquake'),
  mkPsMove('outrage', 'Outrage', { pp: 3, maxpp: 16 }),
  mkPsMove('stoneedge', 'Stone Edge'),
  mkPsMove('swordsdance', 'Swords Dance'),
]

export const sidePokemon = () => [
  mkSidePokemon('Garchomp', { active: true }),
  mkSidePokemon('Starmie'),
  mkSidePokemon('Gengar', { fainted: true }),
]

export function mkUpdate(over: { lines?: string[]; view?: BattleView; request?: PsRequest | null; ended?: any } = {}): ClientMessage {
  return {
    type: 'update',
    lines: over.lines ?? [],
    view: over.view ?? mkView(),
    request: over.request === undefined ? mkRequest({ moves: MOVES, side: sidePokemon() }) : over.request,
    ...(over.ended ? { ended: over.ended } : {}),
  }
}
