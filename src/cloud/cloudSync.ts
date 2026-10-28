import type { EngineEnd } from '../battle/protocol'
import type { Decision, NewOfficial, VoidReason } from '../storage/gameStore'
import { isPermanent, type CloudApi, type StartResult } from './api'

export type TurnState = { turn: number; playerRemaining: number; rivalRemaining: number }

export type SyncOp =
  | { kind: 'start'; entry: NewOfficial; sizes: { player: number; rival: number } }
  | { kind: 'turn'; date: string; decisions: Decision[]; state: TurnState }
  | { kind: 'finish'; date: string; ended: EngineEnd; decisions: Decision[] }
  | { kind: 'void'; date: string; reason: VoidReason }

export const outboxKey = (userId: string) => `daily-pwt:outbox:${userId}`

const dateOf = (op: SyncOp) => (op.kind === 'start' ? op.entry.date : op.date)

/**
 * Réplica del oficial en la base de datos (DEC-63, «local primero»): la partida se guarda antes en local y aquí se encolan, en orden, las
 * llamadas a Supabase. La cola se guarda en el navegador (`daily-pwt:outbox:<usuario>`), así que una caída de la red o una recarga no
 * pierden el final de un oficial: se reintenta en el siguiente envío, al volver la conexión o al abrir la página.
 * - Error de red: se para y se reintenta luego. Rechazo del servidor (estado viejo, oficial ya terminado…): esa llamada se descarta; si
 *   lo rechazado es el empezar, se descarta todo lo de ese día (el oficial no cuenta, RF-104b).
 * - Cada estado lleva todas las decisiones hasta ese turno: si hay varios en cola para el mismo día, basta con el último.
 */
export class CloudSync {
  private queue: SyncOp[]
  private flushing: Promise<void> | null = null

  constructor(
    private readonly api: CloudApi,
    private readonly storage: Storage | null,
    private readonly key: string,
    private readonly onStarted?: (result: StartResult, entry: NewOfficial) => void,
  ) {
    this.queue = this.load()
  }

  private load(): SyncOp[] {
    try {
      const raw = this.storage?.getItem(this.key)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? (parsed as SyncOp[]) : []
    } catch {
      return []
    }
  }

  private persist(): void {
    try {
      if (this.queue.length === 0) this.storage?.removeItem(this.key)
      else this.storage?.setItem(this.key, JSON.stringify(this.queue))
    } catch {
      // Sin almacenamiento la cola vive en memoria: se pierde al recargar, y ese oficial no contará.
    }
  }

  get pending(): number {
    return this.queue.length
  }

  enqueue(op: SyncOp): Promise<void> {
    if (op.kind === 'turn') this.queue = this.queue.filter((queued) => !(queued.kind === 'turn' && queued.date === op.date))
    this.queue.push(op)
    this.persist()
    return this.flush()
  }

  /** Envía lo que haya en cola, en orden. Si ya se está enviando, espera a ese envío y vuelve a mirar. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing.then(() => (this.queue.length > 0 ? this.flush() : undefined))
    this.flushing = this.drain().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const op = this.queue[0]
      try {
        await this.send(op)
        this.queue.shift()
      } catch (error) {
        if (!isPermanent(error)) return
        this.queue.shift()
        if (op.kind === 'start') this.queue = this.queue.filter((queued) => dateOf(queued) !== op.entry.date)
      } finally {
        this.persist()
      }
    }
  }

  private async send(op: SyncOp): Promise<void> {
    switch (op.kind) {
      case 'start': {
        const result = await this.api.startOfficial(op.entry, op.sizes)
        // Otro dispositivo ya había empezado el oficial de hoy (RF-98): lo de este no es de ese combate y no se envía.
        if (!result.created && result.day.battle?.seed !== op.entry.battle.seed) this.queue = this.queue.filter((queued, index) => index === 0 || dateOf(queued) !== op.entry.date)
        this.onStarted?.(result, op.entry)
        return
      }
      case 'turn':
        return this.api.saveTurn(op.date, op.decisions, op.state)
      case 'finish':
        await this.api.finishOfficial(op.date, op.ended, op.decisions)
        return
      case 'void':
        return this.api.voidOfficial(op.date, op.reason)
    }
  }
}
