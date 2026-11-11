import type { CampaignBattleInput } from '../battle/protocol'
import type { CampaignBattleDefinition } from '../core/nuzlocke/battle'
import { createCampaign } from '../core/nuzlocke/campaign'
import { readJson } from './paths'

export function campaignInput(move = 'absorb'): CampaignBattleInput {
  const { encounters } = readJson<Pick<CampaignBattleDefinition, 'encounters'>>('data', 'nuzlocke', 'hoenn-emerald.json')
  const { species } = readJson<Pick<CampaignBattleDefinition, 'species'>>('data', 'nuzlocke', 'hoenn-emerald-progression.json')
  return { definition: { encounters, species }, state: { ...createCampaign('local-campaign'), phase: 'prepare', encounterIndex: move === 'hiddenpower' ? 2 : 0,
    members: [{ id: 'starter', species: move === 'hiddenpower' ? 'grovyle' : 'treecko', level: move === 'hiddenpower' ? 24 : 15,
      history: move === 'hiddenpower' ? [{ species: 'treecko', evolvedAt: 16 }] : [], fainted: false, victories: 0 }] },
  preparation: { unlockedMoves: [], movesByMember: { starter: [move] }, leadId: 'starter' }, selected: ['starter'] }
}
