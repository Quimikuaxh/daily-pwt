/**
 * Objetos equipables de la campaña de Hoenn (Jose, 11/11/2026; PRD §0, DEC-94). Del calendario (`held`): una unidad por fuente de la
 * aventura desde su hito habitual y las bayas, infinitas desde la primera fuente. Competitivos: el canje del Frente Batalla de Esmeralda
 * (`exchange`, con sus precios en PB), pagado con Puntos Batalla que se ganan durante la aventura: BP_PER_GYM por gimnasio ganado y
 * BP_FLAWLESS_BONUS más si nadie se debilita en ese combate, para que pasando los gimnasios de forma normal se puedan comprar 2-3 y
 * alguno más sin bajas (los precios del canje van de 48 a 64 PB).
 */
import calendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import { DataError } from '../errors'
import type { CampaignState } from './campaign'

export const BP_PER_GYM = 20
export const BP_FLAWLESS_BONUS = 8

type HeldEntry = { kind: 'held'; units: readonly { before: string }[] } | { kind: 'berry'; before: string; infinite: true }
const held = calendar.held as unknown as Readonly<Record<string, HeldEntry>>
const exchange = calendar.exchange as readonly { item: string; price: number }[]
const milestoneIndex = (milestone: string) => calendar.milestones.indexOf(milestone)

/** Puntos Batalla de un gimnasio ganado según las bajas del combate. */
export const battlePointsFor = (fainted: readonly boolean[]): number => BP_PER_GYM + (fainted.some(Boolean) ? 0 : BP_FLAWLESS_BONUS)

/** Objetos del canje y su precio en PB. */
export const exchangeItems = (): readonly { item: string; price: number }[] => exchange

/** Unidades de cada objeto equipable conseguidas hasta el hito actual, más las compradas; `Infinity` para las bayas. */
export function heldItemStock(state: Pick<CampaignState, 'encounterIndex' | 'purchases'>): Record<string, number> {
  const stock: Record<string, number> = {}
  for (const [item, entry] of Object.entries(held)) {
    const count = entry.kind === 'berry'
      ? (milestoneIndex(entry.before) <= state.encounterIndex ? Infinity : 0)
      : entry.units.filter(unit => milestoneIndex(unit.before) <= state.encounterIndex).length
    if (count) stock[item] = count
  }
  for (const item of state.purchases ?? []) stock[item] = (stock[item] ?? 0) + 1
  return stock
}

/** Equipa (o quita, con `null`) un objeto a un miembro vivo en la preparación, si queda alguna unidad libre. */
export function equipItem(state: CampaignState, memberId: string, item: string | null): CampaignState {
  if (state.phase !== 'prepare') throw new DataError('Los objetos se equipan en la preparación.')
  const member = state.members.find(candidate => candidate.id === memberId && !candidate.fainted)
  if (!member) throw new DataError('El Pokémon no está disponible.')
  if (item !== null) {
    const used = state.members.filter(other => other.id !== memberId && !other.fainted && other.item === item).length
    if ((heldItemStock(state)[item] ?? 0) - used < 1) throw new DataError(`No queda ${item} libre.`)
  }
  return { ...state, members: state.members.map(other => other.id === memberId ? { ...other, item: item ?? undefined } : other) }
}

/** Compra un objeto del canje con Puntos Batalla, en la preparación. */
export function buyExchangeItem(state: CampaignState, item: string): CampaignState {
  if (state.phase !== 'prepare') throw new DataError('El canje se usa en la preparación.')
  const offer = exchange.find(entry => entry.item === item)
  if (!offer) throw new DataError(`${item} no está en el canje.`)
  const points = state.battlePoints ?? 0
  if (points < offer.price) throw new DataError('No tienes Puntos Batalla suficientes.')
  return { ...state, battlePoints: points - offer.price, purchases: [...(state.purchases ?? []), item] }
}
