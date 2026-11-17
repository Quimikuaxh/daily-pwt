import { LocalCampaignSession } from '../battle/campaignSession'
import type { CampaignBattleClient } from '../battle/client'
import type { CampaignRecord, CampaignStore } from '../storage/campaignStore'
import { validCampaignRecord } from '../storage/campaignValidation'
import type { ProgressRecord, ProgressStore } from '../storage/progressStore'
import { validTowerRecord, type TowerBattle } from '../storage/towerStore'
import type { TowerRun } from '../core/battle-tower/tower'
import { esCampaign } from '../i18n/esCampaign'
import { esTower } from '../i18n/esTower'
import { CloudError, isPermanent, type CampaignReceipt, type CloudApi, type ProgressOperation } from './api'

export const campaignAccountKey = (userId: string) => `daily-pwt:campaign-account:v1:${userId}`
/**
 * `next`: el último cambio hecho mientras `pending` está en vuelo (guardado en segundo plano, Jose, 14/11/2026). Se manda al confirmar
 * `pending`; otro cambio antes lo sustituye (solo vale el último). Va en el diario para no perderlo al recargar.
 */
type Journal<Record> = { version: 1; record: Record | null; pending: ProgressOperation<Record> | null; next?: Record | null; conflict: boolean }
export type CampaignCloudState<Record = CampaignRecord> = {
  status: 'closed' | 'loading' | 'ready' | 'saving' | 'offline' | 'conflict' | 'error'
  record: Record | null
  message: string | null
  persistent: boolean
}

function validJournal<Record extends { revision: number }>(value: unknown, valid: (value: unknown) => value is Record): value is Journal<Record> {
  if (!value || typeof value !== 'object') return false
  const j = value as Journal<Record>
  const p = j.pending
  return j.version === 1 && typeof j.conflict === 'boolean' &&
    (j.record === null || valid(j.record)) && (p === null ||
      (typeof p?.operationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.operationId) &&
        Number.isSafeInteger(p.expectedRevision) && p.expectedRevision >= 0 && valid(p.record) &&
        p.record.revision === p.expectedRevision + 1 && (j.record?.revision ?? 0) === p.expectedRevision)) &&
    (j.next === undefined || j.next === null || (p !== null && valid(j.next) && j.next.revision === p.record.revision + 1))
}

/** Guardado de cuenta separado del diario y del prototipo local. D7 consume el estado y confirma `reload()`. */
class AccountProgress<State, Battle> implements ProgressStore<State, Battle> {
  private api: CloudApi | null = null
  private userId: string | null = null
  private epoch = 0
  private storageUsable = true
  private cacheRead = false
  private journal: Journal<ProgressRecord<State, Battle>> = { version: 1, record: null, pending: null, conflict: false }
  private state: CampaignCloudState<ProgressRecord<State, Battle>> = { status: 'closed', record: null, message: null, persistent: false }
  private readonly listeners = new Set<() => void>()
  /** Quien espera a que se guarde un cambio puesto en cola (`next`): se resuelve al confirmarse esa revisión. */
  private waiters: { revision: number; resolve: (record: ProgressRecord<State, Battle>) => void; reject: (error: Error) => void }[] = []

  constructor(
    private readonly storage: Storage | null,
    private readonly keyFor: (userId: string) => string,
    private readonly valid: (value: unknown) => value is ProgressRecord<State, Battle>,
    private readonly readRemote: (api: CloudApi) => Promise<unknown>,
    private readonly writeRemote: (api: CloudApi, operation: ProgressOperation<ProgressRecord<State, Battle>>) => Promise<CampaignReceipt>,
    private readonly messages: Record<'busy' | 'closed' | 'offline' | 'invalid' | 'conflict', string> = esCampaign,
  ) {}
  getState = (): CampaignCloudState<ProgressRecord<State, Battle>> => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  get persistent() { return this.state.persistent }
  read(): ProgressRecord<State, Battle> | null { return structuredClone(this.state.record) }

  protected stopSessions() {}
  private set(status: CampaignCloudState['status'], message: string | null = null) {
    this.state = { ...this.state, status, message, record: structuredClone(this.journal.next ?? this.journal.pending?.record ?? this.journal.record) }
    if (status === 'conflict' || status === 'error' || status === 'offline') {
      this.stopSessions()
      this.settleWaiters(null, new Error(message ?? this.messages.offline))
    }
    this.listeners.forEach(fn => fn())
  }

  private settleWaiters(confirmed: ProgressRecord<State, Battle> | null, error?: Error) {
    const done = confirmed ? this.waiters.filter((waiter) => waiter.revision <= confirmed.revision) : this.waiters
    this.waiters = this.waiters.filter((waiter) => !done.includes(waiter))
    done.forEach((waiter) => (confirmed ? waiter.resolve(structuredClone(confirmed)) : waiter.reject(error ?? new Error(this.messages.offline))))
  }

  /** Cambiar de cuenta invalida inmediatamente las respuestas y motores del propietario anterior. */
  setAccount(api: CloudApi | null, userId: string | null) {
    if (this.api === api && this.userId === userId) return
    this.epoch++
    this.stopSessions()
    this.api = api
    this.userId = userId
    this.cacheRead = false
    this.journal = { version: 1, record: null, pending: null, conflict: false }
    this.state = { status: 'closed', record: null, message: null, persistent: false }
    this.settleWaiters(null, new Error(this.messages.closed))
    this.listeners.forEach(fn => fn())
  }

  private context() {
    if (!this.api || !this.userId) throw new Error(this.messages.closed)
    const epoch = this.epoch, api = this.api, key = this.keyFor(this.userId)
    return { api, key, check: () => { if (epoch !== this.epoch) throw new Error(this.messages.closed) } }
  }
  private persist() {
    this.state = { ...this.state, persistent: false }
    if (!this.userId || !this.storage || !this.storageUsable) return
    try {
      this.storage.setItem(this.keyFor(this.userId), JSON.stringify(this.journal))
      this.state = { ...this.state, persistent: true }
    } catch { /* Conserva la intención en memoria; D7 puede indicar que no sobrevivirá a una recarga. */ }
  }
  private failure(error: unknown) {
    if (error instanceof CloudError && error.code === 'campaign_revision_conflict') {
      this.journal.conflict = true
      this.persist()
      this.set('conflict', this.messages.conflict)
    } else this.set(isPermanent(error) ? 'error' : 'offline', isPermanent(error) ? this.messages.invalid : this.messages.offline)
  }
  private remote(value: unknown): ProgressRecord<State, Battle> | null {
    if (value !== null && !this.valid(value)) throw new CloudError('invalid_campaign', true)
    return structuredClone(value)
  }

  /** Abrir no importa el prototipo local. Si hay una intención sin confirmar, recupera su mismo UUID. */
  async load(): Promise<void> {
    const { api, key, check } = this.context()
    if (this.state.status === 'ready' || this.state.status === 'conflict' || this.state.status === 'error') return
    if (this.state.status === 'loading' || this.state.status === 'saving') throw new Error(this.messages.busy)
    this.set('loading')
    try {
      let raw: string | null = null
      if (!this.cacheRead) {
        this.cacheRead = true
        try { raw = this.storage?.getItem(key) ?? null } catch { this.storageUsable = false }
      }
      if (raw !== null) {
        let value: unknown
        try { value = JSON.parse(raw) } catch { throw new CloudError('invalid_campaign', true) }
        if (!validJournal(value, this.valid)) throw new CloudError('invalid_campaign', true)
        this.journal = value
        this.state = { ...this.state, persistent: true }
      }
      if (this.journal.conflict) { this.set('conflict', this.messages.conflict); return }
      if (this.journal.pending) {
        await this.sendPending()
        check()
        if (this.getState().status !== 'ready') return
      }
      const remote = this.remote(await this.readRemote(api))
      check()
      if (this.journal.record && (!remote || remote.revision < this.journal.record.revision)) {
        throw new CloudError('invalid_campaign', true)
      }
      // Un recibo antiguo no prueba que siga siendo la revisión vigente.
      if (this.journal.record && remote && remote.revision > this.journal.record.revision) {
        this.journal.conflict = true
        this.persist()
        this.set('conflict', this.messages.conflict)
        return
      }
      this.journal.record = remote
      this.persist()
      this.set('ready')
    } catch (error) { check(); this.failure(error) }
  }

  async write(state: State, battle: Battle | null, expectedRevision: number): Promise<ProgressRecord<State, Battle>> {
    this.context()
    // Guardando otro cambio: este se pone en cola (o sustituye al que ya esperaba) y se manda al confirmar el que está en vuelo. Solo
    // sobre el último cambio conocido (`read()`); uno basado en una revisión anterior sigue siendo un error.
    const inFlight = this.journal.pending
    if (this.state.status === 'saving' && inFlight) {
      if ((this.journal.next ?? inFlight.record).revision !== expectedRevision) throw new Error(this.state.message ?? this.messages.busy)
      const record: ProgressRecord<State, Battle> = structuredClone({ version: 1, revision: inFlight.record.revision + 1, state, battle })
      if (!this.valid(record)) throw new Error(this.messages.invalid)
      this.journal.next = record
      this.persist()
      this.set('saving')
      return new Promise((resolve, reject) => { this.waiters.push({ revision: record.revision, resolve, reject }) })
    }
    if (this.state.status !== 'ready') throw new Error(this.state.message ?? this.messages.busy)
    if ((this.journal.record?.revision ?? 0) !== expectedRevision) throw new Error(this.messages.conflict)
    const record: ProgressRecord<State, Battle> = structuredClone({ version: 1, revision: expectedRevision + 1, state, battle })
    if (!this.valid(record)) throw new Error(this.messages.invalid)
    this.journal.pending = { operationId: crypto.randomUUID(), expectedRevision, record }
    this.persist()
    await this.sendPending()
    if (this.state.status !== 'ready') throw new Error(this.state.message ?? this.messages.offline)
    return structuredClone(record)
  }

  private async sendPending(): Promise<void> {
    const { api, check } = this.context()
    const pending = this.journal.pending
    if (!pending) return
    this.set('saving')
    try {
      const receipt = await this.writeRemote(api, structuredClone(pending))
      check()
      if (!receipt || receipt.operationId !== pending.operationId || receipt.revision !== pending.record.revision) throw new CloudError('invalid_receipt', true)
      this.journal.record = pending.record
      this.journal.pending = null
      const next = this.journal.next
      this.journal.next = null
      if (next) {
        // El cambio en cola sale ahora, sobre lo recién confirmado; la pantalla sigue en `saving` (sin bloquear) hasta el último.
        this.journal.pending = { operationId: crypto.randomUUID(), expectedRevision: pending.record.revision, record: next }
        this.persist()
        this.settleWaiters(pending.record)
        return this.sendPending()
      }
      this.persist()
      this.set('ready')
      this.settleWaiters(pending.record)
    } catch (error) { check(); this.failure(error) }
  }

  /** Reintenta la misma intención; no permite reintentar ni sobrescribir un conflicto. */
  async retry(): Promise<void> {
    if (this.state.status !== 'offline') return
    if (this.journal.pending) await this.sendPending()
    else await this.load()
  }

  /** Invocar solo tras confirmar «Recargar campaña». Un fallo conserva intención, caché y bloqueo. */
  async reload(): Promise<void> {
    const { api, check } = this.context()
    if (this.state.status !== 'conflict') throw new Error(this.messages.busy)
    this.set('loading', this.messages.conflict)
    try {
      const remote = this.remote(await this.readRemote(api))
      check()
      this.stopSessions()
      this.journal = { version: 1, record: remote, pending: null, conflict: false }
      this.persist()
      this.set('ready')
    } catch (error) {
      check()
      this.set('conflict', isPermanent(error) ? this.messages.invalid : this.messages.conflict)
    }
  }

}

export class AccountCampaign extends AccountProgress<CampaignRecord['state'], NonNullable<CampaignRecord['battle']>> implements CampaignStore {
  private readonly sessions = new Set<LocalCampaignSession>()

  constructor(storage: Storage | null) {
    super(storage, campaignAccountKey, validCampaignRecord, api => api.getCampaign(), (api, op) => api.saveCampaign(op))
  }

  protected override stopSessions() {
    this.sessions.forEach(session => session.stop())
    this.sessions.clear()
  }

  createSession(client: CampaignBattleClient): LocalCampaignSession {
    const { status, message } = this.getState()
    if (status !== 'ready') throw new Error(message ?? esCampaign.busy)
    this.stopSessions()
    const session = new LocalCampaignSession(client, this)
    this.sessions.add(session)
    return session
  }
}

export class AccountTower extends AccountProgress<TowerRun, TowerBattle> {
  constructor(storage: Storage | null) {
    super(storage, userId => `daily-pwt:tower-account:v1:${userId}`, validTowerRecord, api => api.getTower(), (api, op) => api.saveTower(op), esTower.cloud)
  }
}
