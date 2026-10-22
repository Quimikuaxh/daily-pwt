import type { BattleRequest, BattleView, MonView, RequestPokemon } from '../../../battle/protocol'
import { isFaintedCondition } from '../../../battle/condition'
import { calcStats, natureEffect } from '../../../core/stats'
import { toId } from '../../../core/id'
import type { DexMove, GameData, ResolvedSet, StatsTable } from '../../../core/types'
import { es } from '../../../i18n/es'
import { moveModel, STAT_KEYS, type MoveModel } from '../../today/cardModel'

export type PartyMove = MoveModel & { pp: number | null; maxPp: number | null; basePower: number; category: DexMove['category'] | null }

export type PartyMember = {
  /** Posición en `request.side.pokemon`, empezando en 1 (lo que espera `choose`). */
  slot: number
  speciesId: string
  /** Id del sprite y del icono (`landorus-therian`), distinto de `speciesId` (`landorustherian`) en las formas. */
  spriteId: string
  name: string
  level: number
  gender: 'M' | 'F' | null
  hp: number
  maxHp: number
  hpPercent: number
  /** Rival: sus PS solo se conocen en porcentaje (como en su caja de PS); `hp` es entonces el porcentaje y `maxHp` 100. */
  hpPercentOnly: boolean
  status: string | null
  fainted: boolean
  active: boolean
  /** Se puede mandar al combate: ni debilitado ni ya en el campo. */
  canSendOut: boolean
  types: { id: string; label: string }[]
  itemName: string
  abilityName: string
  /** Id de la habilidad (clave de las descripciones). */
  abilityId: string
  natureName: string
  natureUp: keyof StatsTable | null
  natureDown: keyof StatsTable | null
  stats: StatsTable
  moves: PartyMove[]
}

const CONDITION = /^(\d+)(?:\/(\d+))?(?:\s+(\w+))?/

function parseCondition(pokemon: RequestPokemon): { hp: number; maxHp: number; status: string | null; fainted: boolean } {
  const fainted = isFaintedCondition(pokemon.condition)
  const match = CONDITION.exec(pokemon.condition.trim())
  const maxHp = Number(match?.[2] ?? 0)
  const status = match?.[3] && match[3] !== 'fnt' ? match[3] : null
  return { hp: fainted ? 0 : Number(match?.[1] ?? 0), maxHp, status: fainted ? null : status, fainted }
}

/** "Garchomp, L50, M" -> M. El género solo viene si la especie lo tiene. */
const genderOf = (details: string): 'M' | 'F' | null => {
  const flag = details.split(',').map((part) => part.trim()).find((part) => part === 'M' || part === 'F')
  return flag === 'M' || flag === 'F' ? flag : null
}

const levelOf = (details: string): number => Number(/L(\d+)/.exec(details)?.[1] ?? 50)

/** Movimiento de la pantalla de datos: el de la tarjeta (Poder Oculto con su tipo y potencia reales) con los PP llenos, potencia y categoría. */
function partyMove(moveId: string, data: GameData, ivs: StatsTable | undefined): PartyMove {
  const model = moveModel(moveId, data, ivs)
  const dexMove = data.dex.moves[moveId]
  const fullPp = dexMove ? Math.floor((dexMove.pp * 8) / 5) : null
  return { ...model, pp: fullPp, maxPp: fullPp, basePower: Number(model.power) || 0, category: dexMove?.category ?? null }
}

/** Movimientos con los PP que le quedan según la vista del combate (llenos si aún no hay vista). */
function partyMoves(moveIds: readonly string[], data: GameData, viewMon: MonView | undefined, ivs: StatsTable | undefined): PartyMove[] {
  return moveIds.map((moveId, index) => {
    const slot = viewMon?.moves?.[index]
    const full = partyMove(moveId, data, ivs)
    return slot ? { ...full, pp: slot.pp, maxPp: slot.maxPp } : full
  })
}

const STAT_FROM_REQUEST: Record<keyof StatsTable, string> = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe' }

/**
 * Los 6 Pokémon del jugador en el orden del simulador (el mismo que usan los botones de cambio), con sus datos reales a Nv. 50.
 * Objeto, habilidad, naturaleza y movimientos salen del set resuelto del reto (`team`); si el set no está (no ocurre en una partida real)
 * se cae a lo que trae el propio request del simulador.
 */
export function partyMembers(request: BattleRequest | null, view: BattleView | null, data: GameData, team: readonly ResolvedSet[]): PartyMember[] {
  const pokemon = request?.side.pokemon ?? []
  return pokemon.flatMap((member, index) => {
    const speciesId = toId(member.details.split(',')[0])
    const set = team.find((candidate) => candidate.species === speciesId)
    const species = data.dex.species[speciesId]
    if (!species) return []
    const condition = parseCondition(member)
    const level = levelOf(member.details)
    const nature = set?.nature ?? ''
    const natureEffects = natureEffect(nature)
    const requestStats = member.stats
    const stats = set
      ? calcStats(species.baseStats, set.ivs, set.evs, set.nature, level)
      : ({ hp: condition.maxHp, ...Object.fromEntries(STAT_KEYS.filter((key) => key !== 'hp').map((key) => [key, requestStats?.[STAT_FROM_REQUEST[key]] ?? 0])) } as StatsTable)
    const itemId = set?.item ?? member.item ?? ''
    const abilityId = set?.ability ?? member.baseAbility ?? ''
    // Debilitado, el simulador manda «0 fnt» sin PS máximos: se toman de las estadísticas.
    const maxHp = condition.maxHp || stats.hp
    return [
      {
        slot: index + 1,
        speciesId,
        spriteId: species.spriteId,
        name: data.names.species[speciesId] ?? set?.nameEs ?? species.name,
        level,
        gender: genderOf(member.details),
        hp: condition.hp,
        maxHp,
        hpPercent: maxHp > 0 ? Math.round((100 * condition.hp) / maxHp) : 0,
        hpPercentOnly: false,
        status: condition.status,
        fainted: condition.fainted,
        active: member.active,
        canSendOut: !condition.fainted && !member.active,
        types: species.types.map((typeName) => ({ id: typeName, label: data.names.types[typeName] ?? typeName })),
        itemName: data.names.items[itemId] ?? (itemId ? es.log.unknownItem : es.battle.summary.noItem),
        abilityName: data.names.abilities[abilityId] ?? es.log.unknownAbility,
        abilityId,
        natureName: (es.battle.summary.natures as Record<string, string>)[nature] ?? nature,
        natureUp: natureEffects?.up ?? null,
        natureDown: natureEffects?.down ?? null,
        stats,
        moves: partyMoves(set?.moves ?? member.moves ?? [], data, view?.player.team.find((mon) => mon.species === speciesId), set?.ivs),
      },
    ]
  })
}

/**
 * Equipo del rival para consultarlo (botón RIVAL; decisiones de Jose del 22/10/2026): los 6 en el orden del motor, con su set completo
 * (Hoy ya lo enseña), PS en porcentaje y los PP que le quedan a cada movimiento.
 */
export function rivalMembers(view: BattleView | null, data: GameData, team: readonly ResolvedSet[]): PartyMember[] {
  return team.flatMap((set, index) => {
    const species = data.dex.species[set.species]
    if (!species) return []
    const mon = view?.rival.team[index]
    const fainted = mon?.fainted ?? false
    const hpPercent = fainted ? 0 : mon?.hpPercent ?? 100
    const natureEffects = natureEffect(set.nature)
    return [
      {
        slot: index + 1,
        speciesId: set.species,
        spriteId: species.spriteId,
        name: data.names.species[set.species] ?? set.nameEs ?? species.name,
        level: set.level,
        gender: set.gender ?? null,
        hp: hpPercent,
        maxHp: 100,
        hpPercent,
        hpPercentOnly: true,
        status: fainted ? null : mon?.status ?? null,
        fainted,
        active: view?.rival.active === index,
        canSendOut: false,
        types: species.types.map((typeName) => ({ id: typeName, label: data.names.types[typeName] ?? typeName })),
        itemName: data.names.items[set.item] ?? (set.item ? es.log.unknownItem : es.battle.summary.noItem),
        abilityName: data.names.abilities[set.ability] ?? es.log.unknownAbility,
        abilityId: set.ability,
        natureName: (es.battle.summary.natures as Record<string, string>)[set.nature] ?? set.nature,
        natureUp: natureEffects?.up ?? null,
        natureDown: natureEffects?.down ?? null,
        stats: calcStats(species.baseStats, set.ivs, set.evs, set.nature, set.level),
        moves: partyMoves(set.moves, data, mon, set.ivs),
      },
    ]
  })
}

/** PS de un miembro como texto: «97/152» los propios; «64 %» los del rival. */
export const memberHpText = (member: Pick<PartyMember, 'hp' | 'maxHp' | 'hpPercentOnly'>): string =>
  member.hpPercentOnly ? es.battle.percent(member.hp) : es.battle.hpValues(member.hp, member.maxHp)

/** Texto de estado de un miembro para lectores de pantalla y para el rótulo bajo el panel. */
export function memberStateLabel(member: PartyMember): string {
  if (member.fainted) return es.battle.party.fainted
  const status = member.status ? (es.battle.status as Record<string, string>)[member.status] : undefined
  if (status) return status
  return member.active ? es.battle.party.inBattle : ''
}

export { STAT_KEYS }
