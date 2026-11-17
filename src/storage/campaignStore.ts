import type { CampaignState } from '../core/nuzlocke/campaign'
import type { SavedCampaignBattle } from '../battle/protocol'
import { validCampaignRecord } from './campaignValidation'
import { CAMPAIGN_STORAGE_KEY } from './campaignSummary'
import { LocalProgressStore, type ProgressRecord, type ProgressStore } from './progressStore'

export { CAMPAIGN_STORAGE_KEY }
export type CampaignRecord = ProgressRecord<CampaignState, SavedCampaignBattle>
export type CampaignStore = ProgressStore<CampaignState, SavedCampaignBattle>

export class LocalCampaignStore extends LocalProgressStore<CampaignState, SavedCampaignBattle> {
  constructor(storage: Storage | null, key = CAMPAIGN_STORAGE_KEY) {
    super(storage, key, validCampaignRecord, {
      damaged: 'El guardado de campaña tiene un formato incompatible o está dañado; se ha conservado sin cambios.',
      conflict: 'La campaña ha cambiado desde otra preparación o sesión.',
      invalid: 'El estado de campaña no se puede guardar.',
    })
  }
}
