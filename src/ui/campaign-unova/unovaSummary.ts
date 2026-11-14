/**
 * Pokémon de la campaña de Teselia en el formato de la pantalla de datos del diario (PartyMember), para reutilizarla tal cual (PRD §0,
 * draft y equipo de N2/B2): estadísticas al nivel dado con 20 IV, sin EV y naturaleza neutra (las de la campaña), la primera habilidad
 * de la especie (la del combate, battle.ts), PS llenos y los movimientos con que llega.
 */
import { NEUTRAL_NATURE } from '../../core/constants'
import { calcStats } from '../../core/stats'
import type { CampaignDefinition } from '../../core/nuzlocke/campaign'
import { defaultMoves } from '../../core/nuzlocke/progression'
import type { GameData, StatsTable } from '../../core/types'
import { es } from '../../i18n/es'
import { partyMove, type PartyMember } from '../battle/party/partyModel'

const all = (value: number): StatsTable => ({ hp: value, atk: value, def: value, spa: value, spd: value, spe: value })

export type SummarySource = {
  species: string
  level: number
  history?: readonly { species: string; evolvedAt: number }[]
  gender?: 'M' | 'F' | null
  item?: string | null
  /** Movimientos elegidos; sin ellos, los que tendría por nivel (`defaultMoves`). */
  moves?: readonly string[]
}

export function unovaSummaryMember(source: SummarySource, definition: CampaignDefinition, data: GameData, slot = 1): PartyMember | null {
  const species = data.dex.species[source.species]
  if (!species) return null
  const stats = calcStats(species.baseStats, all(20), all(0), NEUTRAL_NATURE, source.level)
  const abilityId = species.abilities[0] ?? ''
  const moves = source.moves ?? defaultMoves(definition.species,
    { id: source.species, species: source.species, level: source.level, history: [...(source.history ?? [])], fainted: false, victories: 0 } as never)
  const itemId = source.item ?? ''
  return {
    slot,
    speciesId: source.species,
    spriteId: species.spriteId,
    name: data.names.species[source.species] ?? species.name,
    level: source.level,
    gender: source.gender ?? null,
    hp: stats.hp,
    maxHp: stats.hp,
    hpPercent: 100,
    hpPercentOnly: false,
    status: null,
    fainted: false,
    active: false,
    canSendOut: false,
    types: species.types.map((type) => ({ id: type, label: data.names.types[type] ?? type })),
    itemId,
    itemName: itemId ? data.names.items[itemId] ?? itemId : es.battle.summary.noItem,
    abilityName: data.names.abilities[abilityId] ?? abilityId,
    abilityId,
    natureName: (es.battle.summary.natures as Record<string, string>)[NEUTRAL_NATURE] ?? NEUTRAL_NATURE,
    natureUp: null,
    natureDown: null,
    stats,
    moves: moves.map((move) => partyMove(move, data, undefined)),
  }
}
