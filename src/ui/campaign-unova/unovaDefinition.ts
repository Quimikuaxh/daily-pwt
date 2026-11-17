import unovaCatalog from '../../../data/nuzlocke/unova-n2b2.json'
import unovaProgression from '../../../data/nuzlocke/unova-n2b2-progression.json'
import type { CampaignDefinition } from '../../core/nuzlocke/campaign'
import type { CampaignEncounter } from '../campaign/hoennRoute'

export const unovaEncounters = unovaCatalog.encounters as readonly CampaignEncounter[]
export const unovaDefinition = { campaign: 'unova-n2b2', encounters: unovaEncounters, species: unovaProgression.species } as unknown as CampaignDefinition
