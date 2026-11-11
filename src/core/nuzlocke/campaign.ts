import { DataError } from '../errors'
import { draftOffer, EMERALD_DRAFT_WINDOW, type DraftRequest } from './draft'
import { availableDraftForms } from './draftAvailability'
import emeraldCalendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { gymCounterSpecies } from './gymDraft'
import type { StatsTable } from '../types'
import { advanceLevel, type CampaignMember, type ProgressionDex } from './progression'
import { campaignEvolutionItems, consumedEvolutionItems, emeraldReached, EMERALD_BEAUTY_BEFORE,
  EMERALD_FRIENDSHIP_WINS, EMERALD_LEAGUE_FRIENDSHIP, isEmeraldCampaign, type ScannerChoice } from './calendar'

type Encounter = {
  id: string
  kind: 'gym' | 'elite' | 'champion'
  team: readonly { species: string; level: number }[]
}

export type CampaignDefinition = {
  encounters: readonly Encounter[]
  species: Readonly<Record<string, ProgressionDex[string] & { baseStatTotal: number; types?: readonly string[] }>>
}

type Recruit = CampaignMember & {
  id: string; fainted: boolean; victories: number; hiddenPowerIvs?: StatsTable
  /** Transiciones anteriores al reclutamiento: justifican movimientos, no consumen inventario. */
  recruitmentHistoryLength?: number
}

export type CampaignState = {
  seed: string
  encounterIndex: number
  phase: 'draft' | 'prepare' | 'battle' | 'won' | 'lost'
  pick: number
  offer: readonly string[]
  previousOffer: readonly string[]
  members: readonly Recruit[]
  leagueRoster: readonly string[] | null
  battleTeam: readonly string[]
  battleSeed?: string
  scannerChoice?: ScannerChoice
  /** Alguna oferta del tramo ya incluyó un tipo propio supereficaz. */
  draftTypeCovered?: boolean
}

export function createCampaign(seed: string): CampaignState {
  return {
    seed, encounterIndex: 0, phase: 'draft', pick: 0, offer: [], previousOffer: [],
    members: [], leagueRoster: null, battleTeam: [],
  }
}

function encounterAt(definition: CampaignDefinition, state: CampaignState): Encounter {
  const encounter = definition.encounters[state.encounterIndex]
  if (!encounter) throw new DataError('El encuentro de campaña no existe.')
  return encounter
}

const encounterLevel = (encounter: Encounter) => Math.max(...encounter.team.map(member => member.level))

/** Construye el mismo pool y referencia rival que utiliza el generador de campaña. */
export function campaignDraftRequest(
  definition: CampaignDefinition,
  state: CampaignState,
  eligibleSpecies: readonly string[],
  window: DraftRequest['window'],
): DraftRequest {
  const encounter = encounterAt(definition, state)
  const rivals = encounter.kind === 'gym' ? [encounter] : definition.encounters.slice(state.encounterIndex)
  const total = rivals.reduce((sum, rival) => {
    const teamSum = rival.team.reduce((acc, member) => acc + definition.species[member.species].baseStatTotal, 0)
    return sum + teamSum / rival.team.length
  }, 0)
  const candidates = eligibleSpecies.map(species => {
    if (!Object.hasOwn(definition.species, species)) throw new DataError(`Especie de draft desconocida: ${species}.`)
    return { species, baseStatTotal: definition.species[species].baseStatTotal }
  })
  return {
    seed: state.seed, encounterId: encounter.id, pick: state.pick, previousOffer: state.previousOffer,
    candidates, window, rivalAverage: total / rivals.length,
  }
}

export function openDraft(
  definition: CampaignDefinition, state: CampaignState, eligibleSpecies?: readonly string[], window?: DraftRequest['window'],
): CampaignState {
  if (state.phase !== 'draft') throw new DataError('El draft no está disponible en esta fase.')
  if (state.offer.length) return state
  if (isEmeraldCampaign(definition)) {
    // El llamador no puede ampliar el margen ni introducir formas no viables.
    eligibleSpecies = availableDraftForms(definition, emeraldCalendar, state.encounterIndex, 'A').map(form => form.species)
    window = EMERALD_DRAFT_WINDOW
  }
  if (!eligibleSpecies || !window) throw new DataError('La campaña necesita sus reglas de draft.')
  const request = campaignDraftRequest(definition, state, eligibleSpecies, window)
  const encounter = encounterAt(definition, state)
  const counters = isEmeraldCampaign(definition) && encounter.kind === 'gym'
    ? gymCounterSpecies(definition, encounter.id, eligibleSpecies) : []
  const covered = state.draftTypeCovered === true || (state.pick > 0 && state.previousOffer.some(id => counters.includes(id)))
  const lastPick = state.pick === (state.encounterIndex === 0 ? 3 : 1)
  const needsCounter = isEmeraldCampaign(definition) && encounter.kind === 'gym' && !covered && lastPick
  const offer = draftOffer({
    ...request,
    ...(needsCounter ? { requiredSpecies: counters } : {}),
  })
  return { ...state, offer, draftTypeCovered: covered || offer.some(id => counters.includes(id)) }
}

export function chooseRecruit(definition: CampaignDefinition, state: CampaignState, species: string): CampaignState {
  if (state.phase !== 'draft' || !state.offer.includes(species) || !Object.hasOwn(definition.species, species)) {
    throw new DataError('El Pokémon no está en la oferta actual.')
  }
  const encounter = encounterAt(definition, state)
  let member: Recruit = {
    id: `${encounter.id}:${state.pick}`, species, level: encounterLevel(encounter), history: [], fainted: false, victories: 0,
  }
  if (isEmeraldCampaign(definition)) {
    const form = availableDraftForms(definition, emeraldCalendar, state.encounterIndex, 'A').find(form => form.species === species)
    member = form ? { ...member, history: form.history, recruitmentHistoryLength: form.history.length } : {
      // Conserva la elección de una oferta persistida anterior a la política A.
      ...member, ...advanceLevel(definition.species, { ...member, level: 1 }, member.level, { seed: state.seed, id: member.id }),
    }
  }
  const pick = state.pick + 1
  const required = state.encounterIndex === 0 ? 4 : 2
  return {
    ...state, pick, phase: pick === required ? 'prepare' : 'draft',
    previousOffer: state.offer, offer: [], members: [...state.members, member],
  }
}

export type EvolutionConditions = {
  unlockedItems: ReadonlySet<string>
  friendshipWins: number
  period: 'day' | 'night'
}

function recruitForEvolution(state: CampaignState, id: string): Recruit {
  if (state.phase !== 'prepare') throw new DataError('Las evoluciones especiales se eligen en la preparación.')
  if (state.leagueRoster && !state.leagueRoster.includes(id)) throw new DataError('La caja de la Liga está cerrada.')
  const recruit = state.members.find(member => member.id === id && !member.fainted)
  if (!recruit) throw new DataError('El Pokémon no está disponible para evolucionar.')
  return recruit
}

/** Aplica los requisitos de campaña acordados para objetos, intercambio y amistad. */
export function specialEvolutionOptions(
  definition: CampaignDefinition,
  state: CampaignState,
  id: string,
  conditions: Partial<EvolutionConditions> = {},
): string[] {
  const member = recruitForEvolution(state, id)
  const rules = definition.species[member.species].evolutions
  const emerald = isEmeraldCampaign(definition)
  const wins = emerald ? EMERALD_FRIENDSHIP_WINS : conditions.friendshipWins ?? 0
  const inLeague = emerald && EMERALD_LEAGUE_FRIENDSHIP && encounterAt(definition, state).kind !== 'gym' && !!state.leagueRoster?.includes(member.id)
  const friendshipReady = inLeague || (Number.isInteger(wins) && wins > 0 && member.victories >= wins)
  const unlockedItems = emerald ? campaignEvolutionItems(definition, state) : conditions.unlockedItems ?? new Set<string>()
  const consumed = emerald ? consumedEvolutionItems(definition, state) : new Set<string>()

  return rules.filter(rule => {
    switch (rule.method) {
      case 'ITEM':
      case 'TRADE_ITEM':
        return typeof rule.parameter === 'string' && unlockedItems.has(rule.parameter) && !consumed.has(rule.parameter)
      case 'TRADE':
        return true
      case 'FRIENDSHIP':
        return friendshipReady
      case 'FRIENDSHIP_DAY':
        return friendshipReady && (conditions.period ?? 'day') === 'day'
      case 'FRIENDSHIP_NIGHT':
        return friendshipReady && conditions.period === 'night'
      case 'BEAUTY':
        return emerald && emeraldReached(state, EMERALD_BEAUTY_BEFORE)
      case 'LEVEL_ATK_GT_DEF':
      case 'LEVEL_ATK_LT_DEF':
      case 'LEVEL_ATK_EQ_DEF':
        return typeof rule.parameter === 'number' && member.level >= rule.parameter
      default:
        return false
    }
  }).map(rule => rule.target)
}

export function evolveRecruit(
  definition: CampaignDefinition,
  state: CampaignState,
  id: string,
  target: string,
  conditions: Partial<EvolutionConditions> = {},
): CampaignState {
  if (!Object.hasOwn(definition.species, target) || !specialEvolutionOptions(definition, state, id, conditions).includes(target)) {
    throw new DataError(`Evolución no disponible: ${target}.`)
  }
  return {
    ...state,
    members: state.members.map(member => member.id === id ? {
      ...member, species: target, history: [...member.history, { species: member.species, evolvedAt: member.level }],
    } : member),
  }
}

/** Fija las identidades antes de evolucionar y preparar el primer combate de Liga. */
export function lockLeagueRoster(definition: CampaignDefinition, state: CampaignState, selected: readonly string[]): CampaignState {
  if (state.phase !== 'prepare' || encounterAt(definition, state).kind === 'gym') {
    throw new DataError('La plantilla de Liga solo se fija en su preparación.')
  }
  if (state.leagueRoster) {
    if (selected.length !== state.leagueRoster.length || new Set(selected).size !== selected.length ||
      selected.some(id => !state.leagueRoster!.includes(id))) {
      throw new DataError('La plantilla de la Liga está cerrada.')
    }
    return state
  }
  const alive = new Set(state.members.filter(member => !member.fainted).map(member => member.id))
  if (!selected.length || selected.length > 6 || new Set(selected).size !== selected.length || selected.some(id => !alive.has(id))) {
    throw new DataError('La plantilla de Liga debe tener entre uno y seis miembros vivos distintos.')
  }
  return { ...state, leagueRoster: [...selected] }
}

export function startEncounter(definition: CampaignDefinition, state: CampaignState, selected?: readonly string[]): CampaignState {
  if (state.phase !== 'prepare') throw new DataError('El encuentro todavía no está listo.')
  const encounter = encounterAt(definition, state)
  const alive = new Set(state.members.filter(member => !member.fainted).map(member => member.id))
  const survivors = state.leagueRoster?.filter(id => alive.has(id))
  if (survivors && selected && (survivors.length !== selected.length || survivors.some(id => !selected.includes(id)))) {
    throw new DataError('La plantilla de la Liga está cerrada.')
  }

  const team = selected ?? survivors ?? []
  const limit = encounter.kind === 'gym' ? encounter.team.length : 6
  if (!team.length || team.length > limit || new Set(team).size !== team.length || team.some(id => !alive.has(id))) {
    throw new DataError(`El equipo debe tener entre 1 y ${limit} Pokémon disponibles y distintos.`)
  }

  const leagueRoster = encounter.kind === 'gym' ? null : state.leagueRoster ?? [...team]
  return { ...state, phase: 'battle', battleTeam: [...team], leagueRoster }
}

export function finishEncounter(
  definition: CampaignDefinition,
  state: CampaignState,
  won: boolean,
  fainted: readonly boolean[],
): CampaignState {
  if (state.phase !== 'battle' || state.battleTeam.length !== fainted.length) {
    throw new DataError('El resultado no coincide con las bajas del equipo en combate.')
  }
  const participants = new Map(state.battleTeam.map((id, index) => [id, fainted[index]]))
  const members = state.members.map(member => {
    const knockedOut = participants.get(member.id)
    if (knockedOut) return { ...member, fainted: true }
    if (won && knockedOut === false) return { ...member, victories: member.victories + 1 }
    return member
  })
  const finished = { ...state, members, battleTeam: [], battleSeed: undefined }
  if (!won) return { ...finished, phase: 'lost' }

  const nextIndex = state.encounterIndex + 1
  const next = definition.encounters[nextIndex]
  if (!next) return { ...finished, phase: 'won' }
  if (state.leagueRoster && !members.some(member => !member.fainted && state.leagueRoster?.includes(member.id))) {
    return { ...finished, phase: 'lost' }
  }
  return {
    ...finished,
    encounterIndex: nextIndex,
    phase: state.leagueRoster ? 'prepare' : 'draft',
    pick: 0,
    offer: [],
    draftTypeCovered: false,
    members: members.map(member => member.fainted ? member : { ...member, ...advanceLevel(definition.species, member, encounterLevel(next),
      { seed: state.seed, id: member.id }) }),
  }
}
