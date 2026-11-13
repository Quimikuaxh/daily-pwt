/**
 * MT/MO y objetos de evolución desbloqueados según el calendario de cada campaña (sus reglas: `rules.ts`, DEC-101). Sin reglas (una
 * definición de prueba), el llamador da los desbloqueos.
 */
import { DataError } from '../errors'
import type { CampaignDefinition, CampaignState } from './campaign'
import { reached, rulesOf } from './rules'

export type ScannerChoice = 'deepseatooth' | 'deepseascale'

/** Métodos que gastan su objeto al evolucionar (el parámetro es el objeto). */
export const ITEM_METHODS: ReadonlySet<string> = new Set(['ITEM', 'ITEM_MALE', 'ITEM_FEMALE', 'TRADE_ITEM', 'LEVEL_ITEM_DAY', 'LEVEL_ITEM_NIGHT'])

/** Si la definición es la de Hoenn (Esmeralda). */
export function isEmeraldCampaign(definition: Pick<CampaignDefinition, 'encounters'> & { campaign?: CampaignDefinition['campaign'] }): boolean {
  return rulesOf(definition)?.id === 'hoenn-emerald'
}

export function campaignMachineMoves(
  definition: Pick<CampaignDefinition, 'encounters'> & { campaign?: CampaignDefinition['campaign'] },
  state: Pick<CampaignState, 'encounterIndex'>,
  fallback: ReadonlySet<string> = new Set(),
): ReadonlySet<string> {
  const rules = rulesOf(definition)
  if (!rules) return fallback
  return new Set(Object.entries(rules.machines).flatMap(([move, before]) => reached(rules, state, before) ? [move] : []))
}

/** Los miembros y sus historiales no se eliminan al caer: cada uso permanece consumido al reanudar. */
export function consumedEvolutionItems(definition: CampaignDefinition, state: CampaignState): ReadonlySet<string> {
  const consumed = new Set<string>()
  for (const member of state.members) {
    const stages = [...member.history, { species: member.species }]
    member.history.forEach((stage, index) => {
      if (index < (member.recruitmentHistoryLength ?? 0)) return
      for (const rule of definition.species[stage.species]?.evolutions ?? []) {
        if (ITEM_METHODS.has(rule.method) && typeof rule.parameter === 'string' && rule.target === stages[index + 1].species) consumed.add(rule.parameter)
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
  const rules = rulesOf(definition)
  if (!rules) return new Set()
  const consumed = consumedEvolutionItems(definition, state)
  const selected = scannerChoice(definition, state)
  return new Set(Object.entries(rules.evolutionItems).flatMap(([id, item]) => reached(rules, state, item.before) &&
    !consumed.has(id) && (!item.choice || selected === id) ? [id] : []))
}

export function chooseScannerItem(definition: CampaignDefinition, state: CampaignState, choice: ScannerChoice): CampaignState {
  const rules = rulesOf(definition)
  const item = rules?.evolutionItems[choice]
  if (!rules || !item?.choice || state.phase !== 'prepare' || !reached(rules, state, item.before)) {
    throw new DataError('El canje del Escáner todavía no está disponible.')
  }
  const previous = scannerChoice(definition, state)
  if (previous && previous !== choice) throw new DataError('El premio del Escáner ya se ha elegido.')
  return { ...state, scannerChoice: choice }
}
