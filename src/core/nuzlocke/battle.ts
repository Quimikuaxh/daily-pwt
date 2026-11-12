import { Dex } from '@pkmn/sim'
import { MAX_TURNS } from '../../config'
import type { BattleSet, EngineEnd, EngineInit } from '../../battle/protocol'
import { NEUTRAL_NATURE } from '../constants'
import { DataError } from '../errors'
import { toId } from '../id'
import { deriveSeed, Prng } from '../prng'
import type { StatsTable } from '../types'
import { finishEncounter, startEncounter, type CampaignDefinition, type CampaignState } from './campaign'
import { validateCampaignMoveSelection } from './progression'
import { EMERALD_BATTLE_HAPPINESS, EMERALD_RULES_VERSION, isEmeraldCampaign } from './calendar'

type RivalMember = { species: string; level: number; item: string | null; moves: readonly string[] }
export type CampaignBattleDefinition = {
  encounters: readonly (Omit<CampaignDefinition['encounters'][number], 'team'> & { team: readonly RivalMember[] })[]
  species: Readonly<Record<string, CampaignDefinition['species'][string] & { simulatorSpecies?: string }>>
}

export type BattlePreparation = {
  unlockedMoves: ReadonlySet<string>
  movesByMember: Readonly<Record<string, readonly string[]>>
  leadId?: string
}

const gen3 = Dex.forGen(3)
const stats = (value: number) => ({ hp: value, atk: value, def: value, spa: value, spd: value, spe: value })

const hasHiddenPower = (moves: readonly string[]) => moves.some(move => move.startsWith('hiddenpower'))

function hiddenPowerIvs(seed: string): StatsTable {
  const rng = new Prng(seed)
  const draw = () => 19 + rng.nextInt(2)
  while (true) {
    const ivs = { hp: draw(), atk: draw(), def: draw(), spa: draw(), spd: draw(), spe: draw() }
    if (Object.values(ivs).some(iv => iv !== ivs.hp)) return ivs
  }
}

function battleSet(definition: CampaignBattleDefinition, member: RivalMember, ivs: StatsTable = stats(20)): BattleSet {
  const speciesId = definition.species[member.species]?.simulatorSpecies ?? member.species
  const species = gen3.species.get(speciesId)
  if (!species.exists || !species.abilities[0]) throw new DataError(`Especie de combate desconocida: ${speciesId}.`)
  return {
    species: species.id,
    nameEs: species.name,
    level: member.level,
    item: member.item ?? '',
    ability: toId(species.abilities[0]),
    moves: [...member.moves],
    nature: NEUTRAL_NATURE,
    ivs: { ...ivs },
    evs: stats(0),
  }
}

function activeBattle(definition: CampaignBattleDefinition, state: CampaignState) {
  const encounter = definition.encounters[state.encounterIndex]
  if (state.phase !== 'battle' || !encounter || state.battleTeam.length === 0) {
    throw new DataError('No hay un combate de campaña activo.')
  }
  return encounter
}

function buildCampaignBattleInit(
  definition: CampaignBattleDefinition,
  state: CampaignState,
  { unlockedMoves, movesByMember, leadId }: BattlePreparation,
): EngineInit {
  const encounter = activeBattle(definition, state)
  const playerLead = leadId === undefined ? 0 : state.battleTeam.indexOf(leadId)
  if (playerLead < 0) throw new DataError('El Pokémon inicial no pertenece a la alineación.')
  const player = state.battleTeam.map(id => {
    const member = state.members.find(recruit => recruit.id === id && !recruit.fainted)
    if (!member) throw new DataError(`Pokémon de combate no disponible: ${id}.`)
    const moves = validateCampaignMoveSelection(definition, state, member, movesByMember[id] ?? [], unlockedMoves)
    const ivs = member.hiddenPowerIvs ?? (hasHiddenPower(moves)
      ? hiddenPowerIvs(deriveSeed(state.seed, 'nuzlocke-hidden-power:v1', 'player', id))
      : undefined)
    return { ...battleSet(definition, { species: member.species, level: member.level, item: member.item ?? null, moves }, ivs),
      ...(isEmeraldCampaign(definition) ? { happiness: EMERALD_BATTLE_HAPPINESS } : {}) }
  })
  const battleSeed = deriveSeed(state.seed, 'nuzlocke-battle:v1', encounter.id,
    JSON.stringify([state.battleTeam, playerLead, player]), ...(isEmeraldCampaign(definition) ? [EMERALD_RULES_VERSION] : []))
  return {
    battleSeed,
    generation: 3,
    player,
    playerLead,
    rival: encounter.team.map((member, slot) => {
      const ivs = hasHiddenPower(member.moves)
        ? hiddenPowerIvs(deriveSeed(state.seed, 'nuzlocke-hidden-power:v1', 'rival', encounter.id, String(slot)))
        : undefined
      return battleSet(definition, member, ivs)
    }),
    // El Alto Mando y el campeón miran un turno por delante con lo que han visto; los gimnasios, la heurística (Jose, 12/11/2026).
    ai: encounter.kind === 'gym' ? 'heuristic' : 'lookahead',
    maxTurns: MAX_TURNS,
  }
}

/** Fija la alineación y la identidad del combate en la misma transición. */
export function beginCampaignBattle(
  definition: CampaignBattleDefinition,
  state: CampaignState,
  preparation: BattlePreparation,
  selected?: readonly string[],
): { state: CampaignState; init: EngineInit } {
  const playing = startEncounter(definition, state, selected)
  const init = buildCampaignBattleInit(definition, playing, preparation)
  const newIvs = new Map(playing.battleTeam.flatMap((id, slot) =>
    hasHiddenPower(init.player[slot].moves) ? [[id, init.player[slot].ivs] as const] : []))
  const members = playing.members.map(member => {
    const ivs = newIvs.get(member.id)
    return ivs && !member.hiddenPowerIvs ? { ...member, hiddenPowerIvs: { ...ivs } } : member
  })
  return { state: { ...playing, members, battleSeed: init.battleSeed }, init }
}

/** Rechaza resultados atrasados y conserva el orden de las bajas que devuelve el motor. */
export function finishCampaignBattle(
  definition: CampaignBattleDefinition,
  state: CampaignState,
  ended: EngineEnd,
  battleSeed: string,
): CampaignState {
  activeBattle(definition, state)
  if (state.battleSeed !== battleSeed) {
    throw new DataError('El resultado pertenece a otro combate de campaña.')
  }
  return finishEncounter(definition, state, ended.result === 'win', ended.playerFainted)
}
