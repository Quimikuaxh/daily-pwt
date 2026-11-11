import approved from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { DataError } from '../errors'
import type { CampaignDefinition, CampaignState } from './campaign'

export const EMERALD_RULES_VERSION = approved.rulesVersion
export type ScannerChoice = 'deepseatooth' | 'deepseascale'
type CalendarItem = { before: string; move?: string; quantity?: number; choice?: string }
const items: Readonly<Record<string, CalendarItem>> = approved.items

/** Reconoce el catálogo de 13 encuentros; las definiciones de otras campañas conservan su contrato. */
export function isEmeraldCampaign(definition: Pick<CampaignDefinition, 'encounters'>): boolean {
  return definition.encounters.length === approved.milestones.length &&
    definition.encounters.every((encounter, index) => encounter.id === approved.milestones[index])
}

export function emeraldReached(state: Pick<CampaignState, 'encounterIndex'>, before: string): boolean {
  const index = approved.milestones.indexOf(before)
  return index >= 0 && state.encounterIndex >= index
}

export function campaignMachineMoves(
  definition: Pick<CampaignDefinition, 'encounters'>,
  state: Pick<CampaignState, 'encounterIndex'>,
  fallback: ReadonlySet<string> = new Set(),
): ReadonlySet<string> {
  if (!isEmeraldCampaign(definition)) return fallback
  return new Set(Object.values(items).flatMap(item => item.move && emeraldReached(state, item.before) ? [item.move] : []))
}

/** Los miembros y sus historiales no se eliminan al caer: cada uso permanece consumido al reanudar. */
export function consumedEvolutionItems(definition: CampaignDefinition, state: CampaignState): ReadonlySet<string> {
  const consumed = new Set<string>()
  for (const member of state.members) {
    const stages = [...member.history, { species: member.species }]
    member.history.forEach((stage, index) => {
      if (index < (member.recruitmentHistoryLength ?? 0)) return
      for (const rule of definition.species[stage.species]?.evolutions ?? []) {
        if ((rule.method === 'ITEM' || rule.method === 'TRADE_ITEM') && typeof rule.parameter === 'string' &&
          rule.target === stages[index + 1].species) consumed.add(rule.parameter)
      }
    })
  }
  return consumed
}

function scannerChoice(definition: CampaignDefinition, state: CampaignState): ScannerChoice | undefined {
  const used = consumedEvolutionItems(definition, state)
  return state.scannerChoice ?? (used.has('deepseatooth') ? 'deepseatooth' : used.has('deepseascale') ? 'deepseascale' : undefined)
}

export function campaignEvolutionItems(definition: CampaignDefinition, state: CampaignState): ReadonlySet<string> {
  if (!isEmeraldCampaign(definition)) return new Set()
  const consumed = consumedEvolutionItems(definition, state)
  const selected = scannerChoice(definition, state)
  return new Set(Object.entries(items).flatMap(([id, item]) => !item.move && emeraldReached(state, item.before) &&
    !consumed.has(id) && (!item.choice || selected === id) ? [id] : []))
}

export function chooseScannerItem(definition: CampaignDefinition, state: CampaignState, choice: ScannerChoice): CampaignState {
  if (!isEmeraldCampaign(definition) || state.phase !== 'prepare' ||
    !['deepseatooth', 'deepseascale'].includes(choice) || !emeraldReached(state, items[choice].before)) {
    throw new DataError('El canje del Escáner todavía no está disponible.')
  }
  const previous = scannerChoice(definition, state)
  if (previous && previous !== choice) throw new DataError('El premio del Escáner ya se ha elegido.')
  return { ...state, scannerChoice: choice }
}

export const EMERALD_FRIENDSHIP_WINS = approved.friendshipWins
export const EMERALD_LEAGUE_FRIENDSHIP = approved.leagueFriendship
export const EMERALD_BATTLE_HAPPINESS = approved.battleHappiness
export const EMERALD_BEAUTY_BEFORE = approved.beautyBefore
