import { LocalCampaignSession } from '../battle/campaignSession'
import type { CampaignBattleClient } from '../battle/client'
import type { CampaignRecord, CampaignStore } from '../storage/campaignStore'
import { validCampaignRecord } from '../storage/campaignValidation'
import { esCampaign } from '../i18n/esCampaign'
import { CloudError, isPermanent, type CampaignOperation, type CloudApi } from './api'

export const campaignAccountKey = (userId: string) => `daily-pwt:campaign-account:v1:${userId}`
type Journal = { version: 1; record: CampaignRecord | null; pending: CampaignOperation | null; conflict: boolean }
export type CampaignCloudState = {
  status: 'closed' | 'loading' | 'ready' | 'saving' | 'offline' | 'conflict' | 'error'
  record: CampaignRecord | null
  message: string | null
  persistent: boolean
}

function validJournal(value: unknown): value is Journal {
  if (!value || typeof value !== 'object') return false
  const j = value as Journal
  const p = j.pending
  return j.version === 1 && typeof j.conflict === 'boolean' &&
    (j.record === null || validCampaignRecord(j.record)) && (p === null ||
      (typeof p?.operationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.operationId) &&
        Number.isSafeInteger(p.expectedRevision) && p.expectedRevision >= 0 && validCampaignRecord(p.record) &&
        p.record.revision === p.expectedRevision + 1 && (j.record?.revision ?? 0) === p.expectedRevision))
}

/** Guardado de cuenta separado del diario y del prototipo local. D7 consume el estado y confirma `reload()`. */
export class AccountCampaign implements CampaignStore {
  private api: CloudApi | null = null
  private userId: string | null = null
  private epoch = 0
  private storageUsable = true
  private cacheRead = false
  private journal: Journal = { version: 1, record: null, pending: null, conflict: false }
  private state: CampaignCloudState = { status: 'closed', record: null, message: null, persistent: false }
  private readonly listeners = new Set<() => void>()
  private readonly sessions = new Set<LocalCampaignSession>()

  constructor(private readonly storage: Storage | null) {}
  getState = (): CampaignCloudState => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  get persistent() { return this.state.persistent }
  read(): CampaignRecord | null { return structuredClone(this.state.record) }

  private stopSessions() { this.sessions.forEach(s => s.stop()); this.sessions.clear() }
  private set(status: CampaignCloudState['status'], message: string | null = null) {
    this.state = { ...this.state, status, message, record: structuredClone(this.journal.pending?.record ?? this.journal.record) }
    if (status === 'conflict' || status === 'error' || status === 'offline') this.stopSessions()
    this.listeners.forEach(fn => fn())
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
    this.listeners.forEach(fn => fn())
  }

  private context() {
    if (!this.api || !this.userId) throw new Error(esCampaign.closed)
    const epoch = this.epoch, api = this.api, key = campaignAccountKey(this.userId)
    return { api, key, check: () => { if (epoch !== this.epoch) throw new Error(esCampaign.closed) } }
  }
  private persist() {
    this.state = { ...this.state, persistent: false }
    if (!this.userId || !this.storage || !this.storageUsable) return
    try {
      this.storage.setItem(campaignAccountKey(this.userId), JSON.stringify(this.journal))
      this.state = { ...this.state, persistent: true }
    } catch { /* Conserva la intención en memoria; D7 puede indicar que no sobrevivirá a una recarga. */ }
  }
  private failure(error: unknown) {
    if (error instanceof CloudError && error.code === 'campaign_revision_conflict') {
      this.journal.conflict = true
      this.persist()
      this.set('conflict', esCampaign.conflict)
    } else this.set(isPermanent(error) ? 'error' : 'offline', isPermanent(error) ? esCampaign.invalid : esCampaign.offline)
  }
  private remote(value: unknown): CampaignRecord | null {
    if (value !== null && !validCampaignRecord(value)) throw new CloudError('invalid_campaign', true)
    return structuredClone(value)
  }

  /** Abrir no importa el prototipo local. Si hay una intención sin confirmar, recupera su mismo UUID. */
  async load(): Promise<void> {
    const { api, key, check } = this.context()
    if (this.state.status === 'ready' || this.state.status === 'conflict' || this.state.status === 'error') return
    if (this.state.status === 'loading' || this.state.status === 'saving') throw new Error(esCampaign.busy)
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
        if (!validJournal(value)) throw new CloudError('invalid_campaign', true)
        this.journal = value
        this.state = { ...this.state, persistent: true }
      }
      if (this.journal.conflict) { this.set('conflict', esCampaign.conflict); return }
      if (this.journal.pending) {
        await this.sendPending()
        check()
        if (this.getState().status !== 'ready') return
      }
      const remote = this.remote(await api.getCampaign())
      check()
      if (this.journal.record && (!remote || remote.revision < this.journal.record.revision)) {
        throw new CloudError('invalid_campaign', true)
      }
      // Un recibo antiguo no prueba que siga siendo la revisión vigente.
      if (this.journal.record && remote && remote.revision > this.journal.record.revision) {
        this.journal.conflict = true
        this.persist()
        this.set('conflict', esCampaign.conflict)
        return
      }
      this.journal.record = remote
      this.persist()
      this.set('ready')
    } catch (error) { check(); this.failure(error) }
  }

  async write(state: CampaignRecord['state'], battle: CampaignRecord['battle'], expectedRevision: number): Promise<CampaignRecord> {
    this.context()
    if (this.state.status !== 'ready') throw new Error(this.state.message ?? esCampaign.busy)
    if ((this.journal.record?.revision ?? 0) !== expectedRevision) throw new Error(esCampaign.conflict)
    const record: CampaignRecord = structuredClone({ version: 1, revision: expectedRevision + 1, state, battle })
    if (!validCampaignRecord(record)) throw new Error(esCampaign.invalid)
    this.journal.pending = { operationId: crypto.randomUUID(), expectedRevision, record }
    this.persist()
    await this.sendPending()
    if (this.state.status !== 'ready') throw new Error(this.state.message ?? esCampaign.offline)
    return structuredClone(record)
  }

  private async sendPending(): Promise<void> {
    const { api, check } = this.context()
    const pending = this.journal.pending
    if (!pending) return
    this.set('saving')
    try {
      const receipt = await api.saveCampaign(structuredClone(pending))
      check()
      if (!receipt || receipt.operationId !== pending.operationId || receipt.revision !== pending.record.revision) throw new CloudError('invalid_receipt', true)
      this.journal.record = pending.record
      this.journal.pending = null
      this.persist()
      this.set('ready')
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
    if (this.state.status !== 'conflict') throw new Error(esCampaign.busy)
    this.set('loading', esCampaign.conflict)
    try {
      const remote = this.remote(await api.getCampaign())
      check()
      this.stopSessions()
      this.journal = { version: 1, record: remote, pending: null, conflict: false }
      this.persist()
      this.set('ready')
    } catch (error) {
      check()
      this.set('conflict', isPermanent(error) ? esCampaign.invalid : esCampaign.conflict)
    }
  }

  createSession(client: CampaignBattleClient): LocalCampaignSession {
    if (this.state.status !== 'ready') throw new Error(this.state.message ?? esCampaign.busy)
    this.stopSessions()
    const session = new LocalCampaignSession(client, this)
    this.sessions.add(session)
    return session
  }
}
