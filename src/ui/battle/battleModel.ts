import type { BattleRequest, BattleView, RequestPokemon } from '../../battle/protocol'
import type { GameData, NamesEs, ResolvedSet } from '../../core/types'
import { es } from '../../i18n/es'
import { toId } from '../../core/id'
import { isFaintedCondition } from '../../battle/condition'

/** El verde baja a amarillo y rojo por umbral, como en el juego. */
export const fillFor = (percent: number): 'green' | 'yellow' | 'red' => (percent > 50 ? 'green' : percent > 20 ? 'yellow' : 'red')

/**
 * El Pokémon activo del jugador tiene la barra en rojo y sigue en pie: suena el pitido de vida baja (decisión de Jose, como en N2/B2:
 * nunca por el rival, y se corta al debilitarse).
 */
export function playerInPinch(view: BattleView | null): boolean {
  const active = view?.player.active
  const mon = active == null ? null : view?.player.team[active]
  return !!mon && !mon.fainted && mon.hpPercent > 0 && fillFor(mon.hpPercent) === 'red'
}

const STRUGGLE_ID = 'struggle'

export type MoveOption = {
  /** Posición del movimiento en el request, empezando en 1 (lo que espera `choose`). */
  slot: number
  id: string
  name: string
  typeName: string | null
  typeLabel: string | null
  /** PP actuales y máximos; `null` si el request no los trae (Forcejeo). */
  pp: { current: number; max: number } | null
  disabledReason: string | null
}

/** El simulador pide «Hidden Power Fighting 30» con id `hiddenpower`: se enseña con su tipo real (`hiddenpowerfighting`). */
function shownMoveId(move: { id: string; move: string }): string {
  const hiddenPowerType = move.id === 'hiddenpower' ? /^Hidden Power (\w+)/.exec(move.move)?.[1] : undefined
  return hiddenPowerType ? `hiddenpower${hiddenPowerType.toLowerCase()}` : move.id
}

export function moveOptions(request: BattleRequest | null, data: GameData): MoveOption[] {
  const moves = request?.active?.[0]?.moves ?? []
  return moves.map((move, index) => {
    const shownId = shownMoveId(move)
    const info = data.dex.moves[shownId]
    const outOfPp = move.pp !== undefined && move.pp <= 0
    const name = move.id === STRUGGLE_ID ? es.battle.struggle : data.names.moves[shownId] ?? data.names.moves[toId(move.move)] ?? es.battle.unknownMove
    return {
      slot: index + 1,
      id: move.id,
      name,
      typeName: info?.type ?? null,
      typeLabel: info ? data.names.types[info.type] ?? info.type : null,
      pp: move.pp !== undefined && move.maxpp !== undefined ? { current: move.pp, max: move.maxpp } : null,
      disabledReason: outOfPp ? es.battle.moveReasons.noPp : move.disabled ? es.battle.moveReasons.blocked : null,
    }
  })
}

export type SwitchOption = {
  /** Posición en `request.side.pokemon` (la que usa el sim), empezando en 1. */
  slot: number
  name: string
  hpText: string
  state: 'available' | 'fainted' | 'active'
}

const isFainted = (pokemon: RequestPokemon): boolean => isFaintedCondition(pokemon.condition)

function speciesNameOf(pokemon: RequestPokemon, names: NamesEs): string {
  const speciesName = pokemon.details.split(',')[0]
  return names.species[toId(speciesName)] ?? speciesName
}

function hpTextOf(pokemon: RequestPokemon): string {
  const match = /^(\d+)\/(\d+)/.exec(pokemon.condition)
  return match ? es.battle.hpValues(Number(match[1]), Number(match[2])) : ''
}

export function switchOptions(request: BattleRequest | null, names: NamesEs): SwitchOption[] {
  const team = request?.side.pokemon ?? []
  return team.map((pokemon, index) => ({
    slot: index + 1,
    name: speciesNameOf(pokemon, names),
    hpText: hpTextOf(pokemon),
    state: isFainted(pokemon) ? 'fainted' : pokemon.active ? 'active' : 'available',
  }))
}

export const isForcedSwitch = (request: BattleRequest | null): boolean => Boolean(request?.forceSwitch?.some(Boolean))

/** Motivo por el que no se puede cambiar de Pokémon voluntariamente, o `null` si se puede (RF-47). */
export function switchBlockedReason(request: BattleRequest | null, options: SwitchOption[]): string | null {
  if (request?.active?.[0]?.trapped) return es.battle.switchReasons.trapped
  if (!options.some((option) => option.state === 'available')) return es.battle.switchReasons.nobody
  return null
}

/** RF-48: con una única opción que no es Forcejeo (recarga, dos turnos, movimiento bloqueado) el turno avanza solo. */
export function hasOnlyForcedMove(request: BattleRequest | null): boolean {
  const moves = request?.active?.[0]?.moves ?? []
  return moves.length === 1 && moves[0].id !== STRUGGLE_ID && !isForcedSwitch(request)
}

export const canChoose = (request: BattleRequest | null): boolean =>
  request !== null && !request.wait && (Boolean(request.active?.length) || isForcedSwitch(request))

/** Género del Pokémon en su equipo (el simulador no lo manda en la vista): para el símbolo de la caja de datos. */
export const genderOfSpecies = (team: readonly ResolvedSet[], speciesId: string): 'M' | 'F' | undefined => team.find((set) => set.species === speciesId)?.gender

export const speciesLabel = (names: NamesEs, speciesId: string): string => names.species[speciesId] ?? speciesId
