import type { CampaignDefinition } from './campaign'
import type { CampaignRules } from './rules'

export type Scenario = 'A' | 'B' | 'C'
type Evolution = CampaignDefinition['species'][string]['evolutions'][number]
type History = { species: string; evolvedAt: number }[]

/**
 * Las evoluciones por intercambio son en el Nv37; las que además piden objeto, en el Nv37 y con el objeto (Jose, 12/11/2026: en la
 * campaña no hay intercambio). Antes, las de intercambio sin objeto valían siempre.
 */
export const EMERALD_TRADE_LEVEL = 37
export type Availability = { species: string; history: History }

/** Nivel al que aprende `move` por nivel (o `Infinity`): las evoluciones por ataque sabido valen si puede aprenderlo (PRD §0, 13/11/2026). */
function moveLevel(definition: CampaignDefinition, species: string, move: string): number {
  return Math.min(Infinity, ...(definition.species[species]?.levelUp ?? []).filter((entry) => entry.move === move).map((entry) => entry.level))
}

/**
 * Enumera trayectorias sin consumir inventario: A en la campaña; B/C como controles analíticos. Las de un solo sexo valen (el sexo del
 * recluta se ajusta a su forma al reclutarlo); las de lugar, desde que se llega (`rules.locations`); por ataque sabido, desde el nivel al
 * que lo aprende; Mantyke y Karrablast/Shelmet, en el nivel de intercambio.
 */
export function availableDraftForms(definition: CampaignDefinition, rules: CampaignRules, encounterIndex: number, scenario: Scenario): Availability[] {
  const tradeLevel = rules.tradeLevel
  const reachedBefore = (before: string | null | undefined) => typeof before === 'string' && encounterIndex >= rules.milestones.indexOf(before) && rules.milestones.includes(before)
  const level = Math.max(...definition.encounters[encounterIndex].team.map(mon => mon.level))
  if (scenario === 'C') return Object.keys(definition.species).sort().map(species => ({ species, history: [] }))
  const incoming = new Set(Object.values(definition.species).flatMap(mon => mon.evolutions.map(rule => rule.target)))
  const levelRule = (rule: Evolution) => rule.method.startsWith('LEVEL') && typeof rule.parameter === 'number' && rule.parameter <= level
  const allowed = (rule: Evolution) => {
    if (levelRule(rule)) return true
    if (scenario === 'B') return false
    if (rule.method === 'TRADE' || rule.method === 'TRADE_SPECIES' || rule.method === 'LEVEL_PARTY') return level >= tradeLevel
    if (rule.method.startsWith('FRIENDSHIP')) return encounterIndex >= rules.friendshipWins
    if (rule.method === 'BEAUTY') return reachedBefore(rules.beautyBefore)
    if (rule.method === 'LOCATION') return reachedBefore(rules.locations[String(rule.parameter)])
    if (rule.method === 'LEVEL_MOVE') return moveLevel(definition, ruleSource.get(rule) ?? '', String(rule.parameter)) <= level
    if (['ITEM', 'ITEM_MALE', 'ITEM_FEMALE', 'TRADE_ITEM', 'LEVEL_ITEM_DAY', 'LEVEL_ITEM_NIGHT'].includes(rule.method)) {
      const item = rules.evolutionItems[String(rule.parameter)]
      return !!item && reachedBefore(item.before) && (rule.method !== 'TRADE_ITEM' || level >= tradeLevel)
    }
    return false
  }
  // Especie de la que sale cada regla (para la de ataque sabido, que mira el aprendizaje de la especie previa).
  const ruleSource = new Map(Object.entries(definition.species).flatMap(([species, mon]) => mon.evolutions.map((rule) => [rule, species] as const)))
  const forms = new Map<string, Availability>()
  const visit = (species: string, history: History, evolvedAt: number) => {
    if (history.some(stage => stage.species === species)) throw new Error(`Evolución cíclica: ${species}`)
    const next = definition.species[species].evolutions.filter(allowed)
    // A resuelve las evoluciones automáticas por nivel; las especiales siguen siendo opcionales.
    // B conserva explícitamente las formas base y las intermedias alcanzables solo por nivel.
    const automatic = next.some(rule => levelRule(rule) && rule.method !== 'LEVEL_SHEDINJA')
    if ((scenario === 'B' || !automatic) && !forms.has(species)) forms.set(species, { species, history })
    for (const rule of next) {
      const trade = ['TRADE', 'TRADE_ITEM', 'TRADE_SPECIES', 'LEVEL_PARTY'].includes(rule.method)
      const at = Math.max(evolvedAt, levelRule(rule) ? Number(rule.parameter) : trade ? tradeLevel
        : rule.method === 'LEVEL_MOVE' ? moveLevel(definition, species, String(rule.parameter)) : evolvedAt)
      visit(rule.target, [...history, { species, evolvedAt: at }], at)
    }
  }
  for (const id of Object.keys(definition.species).sort()) if (!incoming.has(id)) visit(id, [], 1)
  return [...forms.values()].sort((a, b) => a.species.localeCompare(b.species))
}

