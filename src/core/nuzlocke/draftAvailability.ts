import type { CampaignDefinition } from './campaign'

export type Scenario = 'A' | 'B' | 'C'
type Evolution = CampaignDefinition['species'][string]['evolutions'][number]
export type DraftCalendar = {
  rulesVersion: string; milestones: string[]; friendshipWins: number; beautyBefore: string
  items: Record<string, { before: string; move?: string; choice?: string }>
}
type History = { species: string; evolvedAt: number }[]

/**
 * Las evoluciones por intercambio son en el Nv37; las que además piden objeto, en el Nv37 y con el objeto (Jose, 12/11/2026: en la
 * campaña no hay intercambio). Antes, las de intercambio sin objeto valían siempre.
 */
export const EMERALD_TRADE_LEVEL = 37
export type Availability = { species: string; history: History }

/** Enumera trayectorias sin consumir inventario: A en Esmeralda; B/C como controles analíticos. */
export function availableDraftForms(definition: CampaignDefinition, calendar: DraftCalendar, encounterIndex: number, scenario: Scenario): Availability[] {
  const level = Math.max(...definition.encounters[encounterIndex].team.map(mon => mon.level))
  if (scenario === 'C') return Object.keys(definition.species).sort().map(species => ({ species, history: [] }))
  const incoming = new Set(Object.values(definition.species).flatMap(mon => mon.evolutions.map(rule => rule.target)))
  const levelRule = (rule: Evolution) => rule.method.startsWith('LEVEL') && typeof rule.parameter === 'number' && rule.parameter <= level
  const allowed = (rule: Evolution) => {
    if (levelRule(rule)) return true
    if (scenario === 'B') return false
    if (rule.method === 'TRADE') return level >= EMERALD_TRADE_LEVEL
    if (rule.method.startsWith('FRIENDSHIP')) return encounterIndex >= calendar.friendshipWins
    if (rule.method === 'BEAUTY') return encounterIndex >= calendar.milestones.indexOf(calendar.beautyBefore)
    if (rule.method === 'ITEM' || rule.method === 'TRADE_ITEM') {
      const item = calendar.items[String(rule.parameter)]
      return !!item && !item.move && encounterIndex >= calendar.milestones.indexOf(item.before) &&
        (rule.method === 'ITEM' || level >= EMERALD_TRADE_LEVEL)
    }
    return false
  }
  const forms = new Map<string, Availability>()
  const visit = (species: string, history: History, evolvedAt: number) => {
    if (history.some(stage => stage.species === species)) throw new Error(`Evolución cíclica: ${species}`)
    const rules = definition.species[species].evolutions.filter(allowed)
    // A resuelve las evoluciones automáticas por nivel; las especiales siguen siendo opcionales.
    // B conserva explícitamente las formas base y las intermedias alcanzables solo por nivel.
    const automatic = rules.some(rule => levelRule(rule) && rule.method !== 'LEVEL_SHEDINJA')
    if ((scenario === 'B' || !automatic) && !forms.has(species)) forms.set(species, { species, history })
    for (const rule of rules) {
      const trade = rule.method === 'TRADE' || rule.method === 'TRADE_ITEM'
      const at = Math.max(evolvedAt, levelRule(rule) ? Number(rule.parameter) : trade ? EMERALD_TRADE_LEVEL : evolvedAt)
      visit(rule.target, [...history, { species, evolvedAt: at }], at)
    }
  }
  for (const id of Object.keys(definition.species).sort()) if (!incoming.has(id)) visit(id, [], 1)
  return [...forms.values()].sort((a, b) => a.species.localeCompare(b.species))
}

