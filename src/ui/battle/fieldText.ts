import { BOOST_IDS, type ActiveState, type BoostId, type FieldEffect } from '../../battle/fieldState'
import type { NamesEs } from '../../core/types'
import { es } from '../../i18n/es'

const text = es.battle.fieldStatus

/** Líneas de una ficha que caben sin pasar al modo compacto (RF-44b). */
export const CARD_LINES = 4
/** En el modo compacto, más niveles que estos van con una flecha y el número. */
export const COMPACT_ARROWS = 3

/** Nombre en español de un efecto: el propio (confusión…), si no el del movimiento o la habilidad que lo pone, con sus capas. */
export function effectLabel(effect: FieldEffect, names: NamesEs): string {
  const label = text.effects[effect.id] ?? names.moves[effect.id] ?? names.abilities[effect.id] ?? effect.id
  return effect.layers && effect.layers > 1 ? text.layers(label, effect.layers) : label
}

export type BoostEntry = { id: BoostId; amount: number }

/** Subidas y bajadas en el orden de siempre (Ataque … Evasión), solo las distintas de 0. */
export const boostEntries = (active: ActiveState): BoostEntry[] =>
  BOOST_IDS.flatMap((id) => (active.boosts[id] ? [{ id, amount: active.boosts[id]! }] : []))

/** Más de 4 líneas (una por estadística y una por efecto): estadísticas abreviadas en dos columnas y los efectos en una línea. */
export const isCompact = (active: ActiveState): boolean => boostEntries(active).length + active.effects.length > CARD_LINES

/** «A», «A y B», «A, B y C». */
function joinList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/** «Viento Afín (3 turnos), Reflejo (4) y Púas ×2»: el primero con «turnos», los demás solo el número (cabe en la caja de mensajes). */
export function effectsSentence(effects: FieldEffect[], names: NamesEs): string {
  let first = true
  return joinList(effects.map((effect) => {
    const label = effectLabel(effect, names)
    if (effect.turns === null) return label
    const turns = first ? text.turnsLong(effect.turns) : String(effect.turns)
    first = false
    return `${label} (${turns})`
  }))
}

/** Mensaje al pulsar una franja: «Tu lado: Viento Afín (3 turnos) y Reflejo (4).» */
export const rowNote = (name: string, effects: FieldEffect[], names: NamesEs): string =>
  `${name}: ${effects.length ? effectsSentence(effects, names) : text.nothing}.`

/** Mensaje al pulsar una ficha: «Pinsir: Ataque +2 y Velocidad −1. Sustituto y Drenadoras.» */
export function cardNote(name: string, active: ActiveState, names: NamesEs): string {
  const boosts = boostEntries(active).map((entry) => text.boost(text.statsLong[entry.id], entry.amount))
  const parts = [boosts.length ? joinList(boosts) : '', active.effects.length ? effectsSentence(active.effects, names) : ''].filter(Boolean)
  return `${name}: ${parts.length ? parts.join('. ') : text.noChanges}.`
}
