import { campaignEvolutionItems } from '../../core/nuzlocke/calendar'
import type { CampaignDefinition, CampaignState } from '../../core/nuzlocke/campaign'
import { heldItemStock } from '../../core/nuzlocke/heldItems'
import type { CampaignRules } from '../../core/nuzlocke/rules'
import type { BagItem } from './bagModel'

/** El tramo anterior usa el mismo inventario y equipo para contar solo las incorporaciones del calendario. */
export function campaignRewards(
  after: CampaignState,
  definition: CampaignDefinition,
  rules: CampaignRules,
  machinesAt: (state: CampaignState) => readonly BagItem[],
) {
  const before = { ...after, encounterIndex: after.encounterIndex - 1 }
  const previousStock = heldItemStock(rules, before)
  const items = new Map<string, number>()
  for (const [id, count] of Object.entries(heldItemStock(rules, after))) {
    const previous = previousStock[id] ?? 0
    if (count > previous) items.set(id, count - previous)
  }
  const previousEvolutionItems = campaignEvolutionItems(definition, before)
  for (const id of campaignEvolutionItems(definition, after)) {
    if (!previousEvolutionItems.has(id)) items.set(id, (items.get(id) ?? 0) + 1)
  }
  const knownMachines = new Set(machinesAt(before).map((item) => item.id))
  const machines = machinesAt(after).filter((item) => !knownMachines.has(item.id))
  return { items: [...items].map(([id, count]) => ({ id, count })), machines }
}
