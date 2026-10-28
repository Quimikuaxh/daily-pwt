import type { BattleClient, ClientMessage } from '../battle/client'
import type { ReplayStep } from './replayData'

/**
 * `BattleClient` sin worker para el visor (DEC-67): en vez de simular, emite los pasos grabados. `init` emite el primero y cada
 * `choose` (el avance rápido de `useBattle` al saltar a un turno, como al reanudar) o `next()` (el visor) emite el siguiente. Los pasos
 * salen sin petición: la pantalla no ofrece menús.
 */
export class ReplayClient implements BattleClient {
  private cursor = 0
  private readonly listeners = new Set<(message: ClientMessage) => void>()

  constructor(private readonly steps: readonly ReplayStep[]) {}

  /** Pasos ya emitidos. */
  get emitted(): number {
    return this.cursor
  }

  get finished(): boolean {
    return this.cursor >= this.steps.length
  }

  private emit(): void {
    const step = this.steps[this.cursor]
    if (!step) return
    this.cursor += 1
    const message: ClientMessage = { type: 'update', ...step, request: null }
    for (const listener of this.listeners) listener(message)
  }

  init(): void {
    this.cursor = 0
    this.emit()
  }

  choose(): void {
    this.emit()
  }

  forfeit(): void {}

  next(): void {
    this.emit()
  }

  subscribe(listener: (message: ClientMessage) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  terminate(): void {
    this.listeners.clear()
  }
}
