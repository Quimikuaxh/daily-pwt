import type { CampaignState } from '../core/nuzlocke/campaign'
import type { SavedCampaignBattle } from '../battle/protocol'
import { validCampaignRecord } from './campaignValidation'

export const CAMPAIGN_STORAGE_KEY = 'daily-pwt:nuzlocke:v1'
export type CampaignRecord = { version: 1; revision: number; state: CampaignState; battle: SavedCampaignBattle | null }
export interface CampaignStore {
  readonly persistent: boolean
  read(): CampaignRecord | null
  write(state: CampaignState, battle: SavedCampaignBattle | null, expectedRevision: number): CampaignRecord | Promise<CampaignRecord>
}

/** Registro independiente del diario. Un formato desconocido o corrupto se conserva y bloquea las escrituras. */
export class LocalCampaignStore {
  persistent = false
  private record: CampaignRecord | null = null
  private usable = true
  private blocked = false

  constructor(private readonly storage: Storage | null, private readonly key = CAMPAIGN_STORAGE_KEY) {
    this.readStorage()
  }

  private readStorage() {
    if (!this.storage || !this.usable) return
    let raw: string | null
    try { raw = this.storage.getItem(this.key) } catch {
      this.usable = false
      this.persistent = false
      return
    }
    try {
      let parsed: CampaignRecord | null = null
      if (raw !== null) {
        const value: unknown = JSON.parse(raw)
        if (!validCampaignRecord(value)) throw new Error('invalid campaign')
        parsed = value
      }
      this.record = parsed
      this.persistent = true
    } catch {
      this.blocked = true
      this.persistent = false
    }
  }

  read(): CampaignRecord | null {
    if (this.persistent) this.readStorage()
    if (this.blocked) throw new Error('El guardado de campaña tiene un formato incompatible o está dañado; se ha conservado sin cambios.')
    return structuredClone(this.record)
  }

  write(state: CampaignState, battle: SavedCampaignBattle | null, expectedRevision: number): CampaignRecord {
    const current = this.read()
    if ((current?.revision ?? 0) !== expectedRevision) throw new Error('La campaña ha cambiado desde otra preparación o sesión.')
    const next: CampaignRecord = structuredClone({ version: 1, revision: expectedRevision + 1, state, battle })
    if (!validCampaignRecord(next)) throw new Error('El estado de campaña no se puede guardar.')
    this.record = next
    if (this.storage && this.usable) {
      try {
        this.storage.setItem(this.key, JSON.stringify(next))
        this.persistent = true
      } catch { this.persistent = false }
    }
    return structuredClone(next)
  }
}
