import { DataError } from '../errors'
import { deriveSeed, Prng } from '../prng'
import { campaignMachineMoves } from './calendar'
import type { CampaignDefinition, CampaignState } from './campaign'

type Evolution = { method: string; parameter: number | string; target: string }
export type ProgressionDex = Readonly<Record<string, {
  levelUp: readonly { level: number; move: string }[]
  machines: readonly string[]
  evolutions: readonly Evolution[]
}>>

export type CampaignMember = {
  species: string
  level: number
  history: readonly { species: string; evolvedAt: number }[]
}

function speciesProgression(dex: ProgressionDex, species: string) {
  if (!Object.hasOwn(dex, species)) throw new DataError(`Especie desconocida en la campaña: ${species}.`)
  return dex[species]
}

/** Aplica las evoluciones por nivel sin condición y conserva el nivel de cada cambio de forma. */
export function advanceLevel(dex: ProgressionDex, member: CampaignMember, level: number, identity?: { seed: string; id: string }): CampaignMember {
  if (!Number.isInteger(level) || level < member.level || level > 100) {
    throw new DataError(`Nivel inválido en la campaña: ${member.level} → ${level}.`)
  }
  let species = member.species
  let evolvedAt = member.level
  const history = [...member.history]
  const visited = new Set([...history.map(stage => stage.species), species])

  while (true) {
    const rules = speciesProgression(dex, species).evolutions
    let evolution = rules.find(rule => rule.method === 'LEVEL' || rule.method === 'LEVEL_NINJASK')
    if (!evolution && rules.some(rule => (rule.method === 'LEVEL_SILCOON' || rule.method === 'LEVEL_CASCOON') &&
      typeof rule.parameter === 'number' && rule.parameter <= level)) {
      if (!identity) throw new DataError('La rama de Wurmple necesita semilla e identidad.')
      const rng = new Prng(deriveSeed(identity.seed, 'nuzlocke-wurmple:v1', identity.id))
      const method = rng.nextInt(2) === 0 ? 'LEVEL_SILCOON' : 'LEVEL_CASCOON'
      evolution = rules.find(rule => rule.method === method)
    }
    if (!evolution || typeof evolution.parameter !== 'number' || evolution.parameter > level) break
    if (visited.has(evolution.target)) throw new DataError(`Evolución cíclica en la campaña: ${species}.`)

    evolvedAt = Math.max(evolvedAt, evolution.parameter)
    history.push({ species, evolvedAt })
    species = evolution.target
    visited.add(species)
  }

  return { ...member, species, level, history }
}

/** La campaña real obtiene sus MT/MO del calendario; no acepta desbloqueos adelantados del llamador. */
export function availableCampaignMoves(
  definition: CampaignDefinition, state: CampaignState, member: CampaignMember,
): string[] {
  return availableMoves(definition.species, member, campaignMachineMoves(definition, state))
}

/** Movimientos con los que combate: los elegidos si siguen siendo legales; si no, los de por defecto. */
export function campaignMemberMoves(definition: CampaignDefinition, state: CampaignState, member: CampaignMember & { moves?: readonly string[] }): string[] {
  const legal = new Set(availableCampaignMoves(definition, state, member))
  return member.moves?.length && member.moves.every((move) => legal.has(move)) ? [...member.moves] : defaultMoves(definition.species, member)
}

/** Guarda los movimientos elegidos para un miembro vivo; comprueba que son legales. */
export function setCampaignMemberMoves(definition: CampaignDefinition, state: CampaignState, id: string, moves: readonly string[]): CampaignState {
  const member = state.members.find((candidate) => candidate.id === id && !candidate.fainted)
  if (!member) throw new DataError(`Miembro de campaña no disponible: ${id}.`)
  const chosen = validateCampaignMoveSelection(definition, state, member, moves)
  return { ...state, members: state.members.map((candidate) => candidate.id === id ? { ...candidate, moves: chosen } : candidate) }
}

export function validateCampaignMoveSelection(
  definition: CampaignDefinition, state: CampaignState, member: CampaignMember,
  selected: readonly string[], fallback: ReadonlySet<string> = new Set(),
): string[] {
  return validateMoveSelection(definition.species, member, campaignMachineMoves(definition, state, fallback), selected)
}

/**
 * Movimientos por defecto, como en el juego: los cuatro últimos aprendidos por nivel en las formas recorridas. Sin MT/MO: esas se
 * eligen en la pantalla Movimientos.
 */
export function defaultMoves(dex: ProgressionDex, member: CampaignMember): string[] {
  // En orden de aprendizaje: forma a forma y, dentro de cada una, por nivel. Lo ya sabido no se vuelve a aprender.
  const learned: string[] = []
  for (const stage of [...member.history, { species: member.species, evolvedAt: member.level }]) {
    const entries = speciesProgression(dex, stage.species).levelUp.filter((entry) => entry.level <= stage.evolvedAt)
    for (const entry of [...entries].sort((a, b) => a.level - b.level)) {
      if (!learned.includes(entry.move)) learned.push(entry.move)
    }
  }
  return learned.slice(-4)
}

/** Une el aprendizaje de las formas recorridas y las máquinas compatibles desbloqueadas. */
export function availableMoves(dex: ProgressionDex, member: CampaignMember, unlocked: ReadonlySet<string>): string[] {
  const moves = new Set<string>()
  for (const stage of [...member.history, { species: member.species, evolvedAt: member.level }]) {
    for (const entry of speciesProgression(dex, stage.species).levelUp) {
      if (entry.level <= stage.evolvedAt) moves.add(entry.move)
    }
  }
  for (const move of speciesProgression(dex, member.species).machines) {
    if (unlocked.has(move)) moves.add(move)
  }
  return [...moves]
}

/** Comprueba la selección manual antes de preparar el set para el combate. */
export function validateMoveSelection(
  dex: ProgressionDex,
  member: CampaignMember,
  unlocked: ReadonlySet<string>,
  selected: readonly string[],
): string[] {
  if (selected.length < 1 || selected.length > 4 || new Set(selected).size !== selected.length) {
    throw new DataError('Elige entre uno y cuatro movimientos distintos.')
  }
  const legal = new Set(availableMoves(dex, member, unlocked))
  for (const move of selected) {
    if (!legal.has(move)) throw new DataError(`Movimiento no disponible para ${member.species}: ${move}.`)
  }
  return [...selected]
}
