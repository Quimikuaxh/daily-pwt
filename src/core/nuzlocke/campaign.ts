import { DataError } from '../errors'
import { draftOffer, draftPool, EMERALD_DRAFT_RATIOS, relativeDraftWindow, type DraftRequest } from './draft'
import { availableDraftForms, EMERALD_TRADE_LEVEL } from './draftAvailability'
import emeraldCalendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { gymCounterSpecies } from './gymDraft'
import { battlePointsFor } from './heldItems'
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
  /** Objeto equipado (heldItems.ts). */
  item?: string
  /** Movimientos elegidos en la pantalla Movimientos (1 a 4); sin ellos, los de `defaultCampaignMoves`. */
  moves?: readonly string[]
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
  /** Ya se aplicaron las evoluciones de la Liga (`evolveForLeague`). */
  leagueEvolved?: boolean
  /** Puntos Batalla por gastar y objetos comprados en el canje (heldItems.ts). */
  battlePoints?: number
  purchases?: readonly string[]
  /** Dificultad elegida al empezar (13/11/2026); sin ella, Normal en las dos (las campañas de antes). */
  difficulty?: CampaignDifficulty
  /** Alineación del último combate (Jose, 12/11/2026): el equipo del tramo siguiente arranca con los que fueron y siguen en pie. */
  lastTeam?: readonly string[]
  /**
   * Colocación de Equipo y PC (Jose, 14/11/2026: se guarda cada cambio, también al salir sin ACEPTAR): el equipo en su orden y los
   * huecos de la caja (`null` vacío). La caja de BAJAS no se guarda: sale de los debilitados.
   */
  teamLayout?: { party: readonly string[]; box: readonly (string | null)[] }
  /** Momento (ms desde 1970) en que empezó; lo pone la interfaz al crearla, para el TIEMPO de la Ficha de Entrenador. */
  startedAt?: number
}

/** Nivel de dificultad (PRD §0, 13/11/2026). */
export type Difficulty = 'easy' | 'normal' | 'hard'
/** `ai`: qué IA usan gimnasios y Liga; `draft`: la ventana de estadísticas base de los candidatos. */
export type CampaignDifficulty = { ai: Difficulty; draft: Difficulty }
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']
export const difficultyOf = (state: Pick<CampaignState, 'difficulty'>): CampaignDifficulty => state.difficulty ?? { ai: 'normal', draft: 'normal' }

export function createCampaign(seed: string, difficulty?: CampaignDifficulty): CampaignState {
  return {
    seed, encounterIndex: 0, phase: 'draft', pick: 0, offer: [], previousOffer: [],
    members: [], leagueRoster: null, battleTeam: [],
    ...(difficulty && (difficulty.ai !== 'normal' || difficulty.draft !== 'normal') ? { difficulty: { ...difficulty } } : {}),
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

/**
 * Elecciones del draft en cada hito: cuatro antes del primer gimnasio, tres al entrar en la Liga (Jose, 11/11/2026: un recluta más para
 * los cinco combates seguidos) y dos antes de cada gimnasio.
 */
export function draftPicks(definition: CampaignDefinition, encounterIndex: number): number {
  if (encounterIndex === 0) return 4
  return definition.encounters[encounterIndex]?.kind === 'gym' ? 2 : 3
}

/**
 * Línea evolutiva de cada especie (la primera de su familia por orden alfabético, como clave estable): componentes conexos de las
 * evoluciones de la definición, así que las ramas (Wurmple → Silcoon/Cascoon, Nincada → Ninjask/Shedinja) son una sola línea.
 */
export function evolutionFamilies(definition: CampaignDefinition): Map<string, string> {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const up = parent.get(id) ?? id
    if (up === id) return id
    const root = find(up)
    parent.set(id, root)
    return root
  }
  const join = (a: string, b: string) => {
    const [x, y] = [find(a), find(b)].sort()
    if (x !== y) parent.set(y, x)
  }
  for (const [id, species] of Object.entries(definition.species)) {
    parent.set(id, parent.get(id) ?? id)
    for (const rule of species.evolutions ?? []) join(id, rule.target)
  }
  return new Map([...parent.keys()].map(id => [id, find(id)]))
}

/**
 * Intentos de ampliar la ventana si, tras quitar las líneas que ya se tienen, no quedan cuatro candidatos: solo por abajo (Pokémon algo
 * más flojos, nunca más fuertes; Jose, 12/11/2026), +50 % del margen inferior cada vez.
 */
const WINDOW_ATTEMPTS = 4

export function openDraft(
  definition: CampaignDefinition, state: CampaignState, eligibleSpecies?: readonly string[], window?: DraftRequest['window'],
): CampaignState {
  if (state.phase !== 'draft') throw new DataError('El draft no está disponible en esta fase.')
  if (state.offer.length) return state
  if (isEmeraldCampaign(definition)) {
    // El llamador no puede ampliar el margen ni introducir formas no viables.
    eligibleSpecies = availableDraftForms(definition, emeraldCalendar, state.encounterIndex, 'A').map(form => form.species)
    const { rivalAverage } = campaignDraftRequest(definition, state, eligibleSpecies, { below: 0, above: 0 })
    const ratio = EMERALD_DRAFT_RATIOS[difficultyOf(state).draft]
    window = relativeDraftWindow(rivalAverage, ratio)
    // No salen especies ni líneas evolutivas que ya se tienen, también las de los caídos (Jose, 12/11/2026; cláusula de repetidos).
    const families = evolutionFamilies(definition)
    const owned = new Set(state.members.map(member => families.get(member.species) ?? member.species))
    eligibleSpecies = eligibleSpecies.filter(id => !owned.has(families.get(id) ?? id))
    // Si no quedan cuatro, se amplía la ventana por abajo (Jose, 12/11/2026: si la norma es inviable tras varios intentos, se salta).
    for (let attempt = 1; attempt <= WINDOW_ATTEMPTS && draftPool(campaignDraftRequest(definition, state, eligibleSpecies, window)).length < 4; attempt++) {
      window = relativeDraftWindow(rivalAverage, { below: ratio.below * (1 + attempt / 2), above: ratio.above })
    }
  }
  if (!eligibleSpecies || !window) throw new DataError('La campaña necesita sus reglas de draft.')
  const request = campaignDraftRequest(definition, state, eligibleSpecies, window)
  const encounter = encounterAt(definition, state)
  const counters = isEmeraldCampaign(definition) && encounter.kind === 'gym'
    ? gymCounterSpecies(definition, encounter.id, eligibleSpecies) : []
  const covered = state.draftTypeCovered === true || (state.pick > 0 && state.previousOffer.some(id => counters.includes(id)))
  const lastPick = state.pick === draftPicks(definition, state.encounterIndex) - 1
  // Garantía de tipo propio supereficaz: si en el último intento del hito no queda ningún candidato que la cumpla (p. ej., Erico con
  // los suyos ya reclutados), se salta (Jose, 12/11/2026).
  const pool = new Set(draftPool(request))
  const reachable = counters.some(id => pool.has(id))
  const needsCounter = isEmeraldCampaign(definition) && encounter.kind === 'gym' && !covered && lastPick && reachable
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
  const required = draftPicks(definition, state.encounterIndex)
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
        return typeof rule.parameter === 'string' && unlockedItems.has(rule.parameter) && !consumed.has(rule.parameter)
      // Intercambio: en el Nv37 (y con el objeto si lo pide; Jose, 12/11/2026). Fuera de Esmeralda, como antes.
      case 'TRADE_ITEM':
        return typeof rule.parameter === 'string' && unlockedItems.has(rule.parameter) && !consumed.has(rule.parameter) &&
          (!emerald || member.level >= EMERALD_TRADE_LEVEL)
      case 'TRADE':
        return !emerald || member.level >= EMERALD_TRADE_LEVEL
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

/**
 * Vías de evolución que no necesitan objeto (Jose, 11/11/2026): al entrar en la Liga se aplican sin esperar nivel ni condición, para que
 * se puedan usar Pokémon que tardan demasiado en evolucionar (Tyranitar, Salamence). Las de piedra u objeto evolutivo (`ITEM`,
 * `TRADE_ITEM`) siguen en `evolveRecruit` con el inventario. Wurmple ya se resolvió por semilla al subir de nivel y Shedinja no es una
 * evolución del miembro.
 */
const LEAGUE_FREE_EVOLUTIONS = new Set(['LEVEL', 'LEVEL_NINJASK', 'LEVEL_ATK_LT_DEF', 'LEVEL_ATK_GT_DEF', 'LEVEL_ATK_EQ_DEF',
  'FRIENDSHIP', 'FRIENDSHIP_DAY', 'FRIENDSHIP_NIGHT', 'TRADE', 'BEAUTY'])

/** Caminos de evolución sin objeto desde una especie hasta cada forma final (la propia especie si no evoluciona así). */
function leaguePaths(definition: CampaignDefinition, species: string, seen: ReadonlySet<string> = new Set([species])): string[][] {
  const next = definition.species[species]?.evolutions.filter(rule =>
    LEAGUE_FREE_EVOLUTIONS.has(rule.method) && Object.hasOwn(definition.species, rule.target) && !seen.has(rule.target)) ?? []
  if (!next.length) return [[species]]
  const targets = [...new Set(next.map(rule => rule.target))]
  return targets.flatMap(target => leaguePaths(definition, target, new Set([...seen, target])).map(path => [species, ...path]))
}

/** Formas finales a las que puede llegar un miembro en la Liga sin objeto; con más de una, elige el jugador. */
export function leagueEvolutionTargets(definition: CampaignDefinition, species: string): string[] {
  return [...new Set(leaguePaths(definition, species).map(path => path[path.length - 1]))].sort()
}

/**
 * Evoluciona a la forma final cada miembro vivo de la caja al preparar la Liga (una sola vez). `choices` da la forma elegida para los que
 * tienen varias (id del miembro → especie). Cada forma intermedia queda en el historial al nivel actual, así que sus movimientos de nivel
 * hasta ese nivel siguen disponibles.
 */
export function evolveForLeague(definition: CampaignDefinition, state: CampaignState, choices: Readonly<Record<string, string>> = {}): CampaignState {
  if (state.phase !== 'prepare' || encounterAt(definition, state).kind === 'gym' || state.leagueRoster) {
    throw new DataError('Las evoluciones de la Liga se aplican al preparar la Liga, antes de fijar la plantilla.')
  }
  if (state.leagueEvolved) return state
  const members = state.members.map(member => {
    if (member.fainted) return member
    const paths = leaguePaths(definition, member.species)
    const finals = [...new Set(paths.map(path => path[path.length - 1]))]
    const target = finals.length === 1 ? finals[0] : choices[member.id]
    if (!target || !finals.includes(target)) throw new DataError(`Elige la evolución de ${member.species} para la Liga.`)
    if (target === member.species) return member
    const path = paths.find(candidate => candidate[candidate.length - 1] === target)!
    const stages = path.slice(0, -1).map(species => ({ species, evolvedAt: member.level }))
    return { ...member, species: target, history: [...member.history, ...stages] }
  })
  return { ...state, members, leagueEvolved: true }
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
  if (isEmeraldCampaign(definition) && !state.leagueEvolved) throw new DataError('Aplica antes las evoluciones de la Liga.')
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
  const gymWin = won && isEmeraldCampaign(definition) && encounterAt(definition, state).kind === 'gym'
  const earned = gymWin ? battlePointsFor(fainted) : 0
  const finished = { ...state, members, battleTeam: [], lastTeam: [...state.battleTeam], battleSeed: undefined, ...(earned ? { battlePoints: (state.battlePoints ?? 0) + earned } : {}) }
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
