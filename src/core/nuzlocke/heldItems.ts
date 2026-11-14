/**
 * Objetos equipables de la campaña (Jose, 11/11/2026; PRD §0, DEC-94), con las reglas de cada una (`rules.ts`, DEC-104). Del calendario
 * (`held`): una unidad por fuente de la aventura desde su hito habitual; las bayas (y en Teselia lo de tienda), sin límite desde la primera
 * fuente. Competitivos: el canje (`exchange`, con sus precios en PB), pagado con Puntos Batalla que se ganan durante la aventura: los de
 * `battlePoints` por gimnasio ganado y unos pocos más si nadie se debilita, para que pasando los gimnasios de forma normal se puedan
 * comprar 2-3 de los caros y alguno más sin bajas.
 */
import { DataError } from '../errors'
import type { CampaignState } from './campaign'
import type { CampaignRules } from './rules'

const milestoneIndex = (rules: CampaignRules, milestone: string) => rules.milestones.indexOf(milestone)

/** Puntos Batalla de un gimnasio ganado según las bajas del combate (Hoenn: 20 y 8 más sin bajas; Teselia: 8 y 3, `rules.ts`). */
export const battlePointsFor = (rules: CampaignRules, fainted: readonly boolean[]): number =>
  rules.battlePoints.perGym + (fainted.some(Boolean) ? 0 : rules.battlePoints.flawlessBonus)

/** Objetos del canje y su precio en PB. */
export const exchangeItems = (rules: CampaignRules): readonly { item: string; price: number }[] => rules.exchange

/** Unidades de cada objeto equipable conseguidas hasta el hito actual, más las compradas; `Infinity` para las bayas. */
export function heldItemStock(rules: CampaignRules, state: Pick<CampaignState, 'encounterIndex' | 'purchases'>): Record<string, number> {
  const stock: Record<string, number> = {}
  for (const [item, entry] of Object.entries(rules.held)) {
    // Sin límite (bayas, y en Teselia lo de tienda) desde su primera fuente; si no, una unidad por fuente alcanzada.
    const count = entry.infinite
      ? (milestoneIndex(rules, entry.before) <= state.encounterIndex ? Infinity : 0)
      : entry.units.filter(unit => milestoneIndex(rules, unit.before) <= state.encounterIndex).length
    if (count) stock[item] = count
  }
  for (const item of state.purchases ?? []) stock[item] = (stock[item] ?? 0) + 1
  return stock
}

/** Equipa (o quita, con `null`) un objeto a un miembro vivo en la preparación, si queda alguna unidad libre. */
export function equipItem(rules: CampaignRules, state: CampaignState, memberId: string, item: string | null): CampaignState {
  if (state.phase !== 'prepare') throw new DataError('Los objetos se equipan en la preparación.')
  const member = state.members.find(candidate => candidate.id === memberId && !candidate.fainted)
  if (!member) throw new DataError('El Pokémon no está disponible.')
  if (item !== null) {
    const used = state.members.filter(other => other.id !== memberId && !other.fainted && other.item === item).length
    if ((heldItemStock(rules, state)[item] ?? 0) - used < 1) throw new DataError(`No queda ${item} libre.`)
  }
  return { ...state, members: state.members.map(other => other.id === memberId ? { ...other, item: item ?? undefined } : other) }
}

/** Compra un objeto del canje con Puntos Batalla, en la preparación. */
export function buyExchangeItem(rules: CampaignRules, state: CampaignState, item: string): CampaignState {
  if (state.phase !== 'prepare') throw new DataError('El canje se usa en la preparación.')
  const offer = rules.exchange.find(entry => entry.item === item)
  if (!offer) throw new DataError(`${item} no está en el canje.`)
  const points = state.battlePoints ?? 0
  if (points < offer.price) throw new DataError('No tienes Puntos Batalla suficientes.')
  return { ...state, battlePoints: points - offer.price, purchases: [...(state.purchases ?? []), item] }
}
