import type { CampaignBattleClient, CampaignClientMessage } from './client'
import type { CampaignBattleInput, CampaignDecision, Choice, SavedCampaignBattle } from './protocol'
import type { CampaignStore, CampaignRecord } from '../storage/campaignStore'
import { es } from '../i18n/es'
import { esCampaign } from '../i18n/esCampaign'

let sessionNumber = 0
type Pending = { id: string; revision: number; kind: 'prepare' | 'resume' | 'decision' | 'finish'; previous: CampaignRecord }

/**
 * Dueño del estado en el hilo principal. Guarda antes de enviar y confirma cada respuesta correlacionada.
 * Una recarga reconstruye en el worker; no importa el simulador ni mantiene un segundo motor.
 */
export class LocalCampaignSession {
  private readonly prefix = `campaign-${++sessionNumber}`
  private sequence = 0
  private pending: Pending | null = null
  private ready = false
  private knownRevision: number | null = null
  private stopped = false
  private saving = false
  private readonly listeners = new Set<(message: CampaignClientMessage) => void>()
  private readonly unsubscribe: () => void

  constructor(private readonly client: CampaignBattleClient, private readonly store: CampaignStore) {
    this.unsubscribe = client.subscribe(message => this.receive(message))
  }

  snapshot(): CampaignRecord | null { return this.stopped ? null : this.store.read() }
  get persistent(): boolean { return this.store.persistent }
  subscribe(listener: (message: CampaignClientMessage) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private emit(message: CampaignClientMessage) { this.listeners.forEach(listener => listener(message)) }
  private nextId() { return `${this.prefix}:${++this.sequence}` }
  private active(): CampaignRecord & { battle: SavedCampaignBattle } {
    if (this.stopped || this.saving || this.pending || !this.ready) throw new Error(esCampaign.notReady)
    const record = this.store.read()
    if (!record?.battle?.init) throw new Error(esCampaign.noBattle)
    if (record.revision !== this.knownRevision) throw new Error(esCampaign.staleSession)
    return record as CampaignRecord & { battle: SavedCampaignBattle }
  }

  /** Conserva el recorrido síncrono local; con cuenta espera el guardado antes de continuar. */
  private persist(state: CampaignRecord['state'], battle: CampaignRecord['battle'], revision: number,
    next: (record: CampaignRecord) => void): void | Promise<void> {
    this.saving = true
    const done = (record: CampaignRecord) => {
      this.saving = false
      if (!this.stopped) next(record)
    }
    try {
      const result = this.store.write(state, battle, revision)
      if (result instanceof Promise) return result.then(done).catch(error => { this.saving = false; throw error })
      done(result)
    } catch (error) { this.saving = false; throw error }
  }

  prepare(input: CampaignBattleInput): void | Promise<void> {
    if (this.stopped || this.saving) throw new Error(esCampaign.sessionBusy)
    const current = this.store.read()
    const { definition, ...source } = structuredClone(input)
    this.ready = false
    return this.persist(source.state, { source, init: null, decisions: [], checkpoint: null }, current?.revision ?? 0, next => {
      this.pending = { id: this.nextId(), revision: next.revision, kind: 'prepare', previous: next }
      this.client.prepare(this.pending.id, { definition, ...source })
    })
  }

  resume(definition: CampaignBattleInput['definition']): void {
    if (this.stopped || this.saving || this.pending) throw new Error(esCampaign.resumeBusy)
    const record = this.store.read()
    if (!record?.battle) throw new Error(esCampaign.noSavedBattle)
    const { battle } = record
    this.ready = false
    this.pending = { id: this.nextId(), revision: record.revision, kind: battle.init ? 'resume' : 'prepare', previous: record }
    if (battle.init) this.client.resume(this.pending.id, { definition, state: record.state, battle: { ...battle, init: battle.init } })
    else this.client.prepare(this.pending.id, { definition, ...battle.source })
  }

  choose(choice: Choice): void | Promise<void> { return this.decide(choice) }
  forfeit(): void | Promise<void> { return this.decide({ type: 'forfeit' }) }
  private decide(decision: CampaignDecision): void | Promise<void> {
    const current = this.active()
    if (current.battle.checkpoint?.update.ended) throw new Error(esCampaign.ended)
    const battleSeed = current.battle.init!.battleSeed
    return this.persist(current.state,
      { ...current.battle, decisions: [...current.battle.decisions, decision] }, current.revision, next => {
        this.pending = { id: this.nextId(), revision: next.revision, kind: 'decision', previous: current }
        if (decision.type === 'forfeit') this.client.forfeit(this.pending.id, battleSeed)
        else this.client.choose(this.pending.id, battleSeed, decision)
      })
  }

  finish(definition: CampaignBattleInput['definition']): void {
    const record = this.active()
    this.pending = { id: this.nextId(), revision: record.revision, kind: 'finish', previous: record }
    this.client.finish(this.pending.id, { definition, state: record.state, battleSeed: record.battle.init!.battleSeed })
  }

  private receive(message: CampaignClientMessage) {
    if (this.stopped || this.saving) return
    const pending = this.pending
    if (message.type === 'campaign-error' && message.requestId === null) {
      this.pending = null
      this.ready = false
      this.emit(message)
      return
    }
    if (!pending || message.requestId !== pending.id) return
    const failed = () => {
      if (this.stopped) return
      this.pending = null
      this.ready = false
      this.emit({ type: 'campaign-error', requestId: message.requestId, message: es.errors.engine })
    }
    try {
      const record = this.store.read()
      if (!record?.battle || record.revision !== pending.revision) throw new Error('stale campaign')
      let state = record.state
      let battle: SavedCampaignBattle | null = record.battle
      let save = true
      let ready = false
      if (message.type === 'campaign-error') {
        save = pending.kind === 'decision'
        if (save) { state = pending.previous.state; battle = pending.previous.battle }
        ready = pending.kind === 'decision' || pending.kind === 'finish'
      } else if (pending.kind === 'prepare' && message.type === 'campaign-prepared') {
        state = message.state
        battle = { ...record.battle, init: message.init, checkpoint: { decisions: 0, update: message.update } }
        ready = true
      } else if ((pending.kind === 'resume' && message.type === 'campaign-resumed') ||
        (pending.kind === 'decision' && message.type === 'campaign-update')) {
        if (message.battleSeed !== record.battle.init?.battleSeed) throw new Error('stale battle')
        battle = { ...record.battle, checkpoint: { decisions: record.battle.decisions.length, update: message.update } }
        ready = true
      } else if (pending.kind === 'finish' && message.type === 'campaign-finished') {
        if (message.battleSeed !== record.battle.init?.battleSeed) throw new Error('stale result')
        state = message.state
        battle = null
      } else throw new Error('unexpected campaign response')
      const done = (saved: CampaignRecord) => {
        this.ready = ready
        this.knownRevision = ready ? saved.revision : null
        this.pending = null
        this.emit(message)
      }
      if (save) {
        const result = this.persist(state, battle, record.revision, done)
        if (result instanceof Promise) void result.catch(failed)
      } else done(record)
    } catch { failed() }
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    this.pending = null
    this.unsubscribe()
    this.listeners.clear()
    this.client.terminate()
  }
}
