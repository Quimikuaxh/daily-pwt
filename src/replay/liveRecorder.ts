import type { BattleClient } from '../battle/client'
import type { AiKind, EngineEnd } from '../battle/protocol'
import { MAX_TURNS } from '../config'
import type { Challenge } from '../core/types'
import type { Decision } from '../storage/gameStore'
import type { ReplayStep } from './replayData'

/**
 * Directo (RF-111c, DEC-80): juega en el motor del espectador el oficial de un amigo con sus decisiones, a medida que llegan del servidor,
 * y apunta los pasos que el visor enseña. Como al reanudar un oficial, el motor es determinista dado la semilla, el inicial y la IA, así
 * que sale el mismo combate. Cada vez que el motor pide una decisión se le da la siguiente que haya; si aún no ha llegado, espera.
 */
export type LiveSnapshot = { steps: ReplayStep[]; ended: EngineEnd | null; failed: boolean }

export type LiveStart = { challenge: Challenge; seed: string; ai: AiKind; leadIndex: number }

export class LiveRecorder {
  private readonly steps: ReplayStep[] = []
  private decisions: readonly Decision[] = []
  private used = 0
  private waiting = false
  private ended: EngineEnd | null = null
  private failed = false
  private readonly unsubscribe: () => void

  constructor(private readonly client: BattleClient, start: LiveStart, private readonly onChange: (snapshot: LiveSnapshot) => void) {
    this.unsubscribe = client.subscribe((message) => {
      if (message.type === 'error') {
        this.failed = true
      } else {
        this.steps.push({ lines: message.lines, view: message.view, ...(message.ended ? { ended: message.ended } : {}) })
        if (message.ended) this.ended = message.ended
        this.waiting = message.request !== null && !message.ended
        this.feed()
      }
      this.onChange(this.snapshot())
    })
    const { challenge } = start
    client.init({ battleSeed: start.seed, player: challenge.playerTeam, playerLead: start.leadIndex, rival: challenge.rivalTeam, ai: start.ai, maxTurns: MAX_TURNS })
  }

  snapshot(): LiveSnapshot {
    return { steps: [...this.steps], ended: this.ended, failed: this.failed }
  }

  /** Decisiones del servidor (todas, desde el principio): solo se usan las nuevas. */
  update(decisions: readonly Decision[]): void {
    if (decisions.length > this.decisions.length) this.decisions = decisions
    this.feed()
  }

  /** Decisiones que el motor ya ha jugado. */
  get played(): number {
    return this.used
  }

  private feed(): void {
    if (!this.waiting || this.used >= this.decisions.length) return
    const decision = this.decisions[this.used]
    this.used += 1
    this.waiting = false
    if (decision.type === 'forfeit') this.client.forfeit()
    else this.client.choose(decision)
  }

  stop(): void {
    this.unsubscribe()
    this.client.terminate()
  }
}
