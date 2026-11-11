/**
 * Modelo de la Mochila de la campaña (D7, maqueta aprobada el 11/11/2026; item_menu.c): bolsillos OBJETOS (equipables conseguidos y
 * comprados en el canje) y BAYAS (infinitas), con las unidades libres de cada objeto (las que no lleva otro miembro vivo), nombre de la
 * época y descripción, y la ventana de la lista: 8 filas que se desplazan, terminando en CERRAR MOCHILA.
 */
import calendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import descriptions from '../../../data/nuzlocke/emerald-item-descriptions-es.json'
import names from '../../../data/nuzlocke/emerald-item-names-es.json'
import type { CampaignState } from '../../core/nuzlocke/campaign'
import { heldItemStock } from '../../core/nuzlocke/heldItems'

export type Pocket = 'items' | 'berries'
export const POCKETS: readonly Pocket[] = ['items', 'berries']
export const VISIBLE_ROWS = 8

export type BagItem = { id: string; name: string; text: string; free: number }

const kinds = calendar.held as Record<string, { kind: string }>
const itemNames = names.items as Record<string, string>
const itemTexts = descriptions.items as Record<string, string>

export const itemName = (id: string): string => itemNames[id] ?? id.toUpperCase()
export const itemText = (id: string): string => itemTexts[id] ?? ''
const pocketOf = (id: string): Pocket => (kinds[id]?.kind === 'berry' ? 'berries' : 'items')

/** Objetos del bolsillo con unidades libres para `memberId` (lo que lleva él cuenta como libre: se puede volver a dar). */
export function bagContents(state: Pick<CampaignState, 'encounterIndex' | 'purchases' | 'members'>, pocket: Pocket, memberId: string): BagItem[] {
  const stock = heldItemStock(state)
  return Object.entries(stock).flatMap(([id, count]) => {
    if (pocketOf(id) !== pocket) return []
    const used = state.members.filter((member) => member.id !== memberId && !member.fainted && member.item === id).length
    const free = count - used
    return free > 0 ? [{ id, name: itemName(id), text: itemText(id), free }] : []
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Primera fila visible para que `cursor` se vea en una ventana de VISIBLE_ROWS filas (`rows` incluye CERRAR MOCHILA). */
export function scrollFor(cursor: number, scroll: number, rows: number): number {
  if (cursor < scroll) return cursor
  if (cursor >= scroll + VISIBLE_ROWS) return Math.min(rows - VISIBLE_ROWS, cursor - VISIBLE_ROWS + 1)
  return scroll
}
