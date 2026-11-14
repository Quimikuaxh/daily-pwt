/**
 * Mochila de la campaña de Teselia (maqueta aprobada el 14/11/2026): los mismos bolsillos que Hoenn (bagModel) con los objetos de N2/B2.
 * OBJETOS y BAYAS, los equipables conseguidos y canjeados (`heldItemStock` con las reglas de Teselia) con las unidades libres; OBJ. EVOL. y
 * MT/MO, solo para mirar (la campaña los usa sola). Nombres y descripciones de 5.ª generación, los del diario.
 */
import unovaCalendar from '../../../data/nuzlocke/unova-n2b2-calendar.json'
import unovaItems from '../../../data/nuzlocke/unova-n2b2-items.json'
import descriptions from '../../generated/descriptions-es.json'
import type { CampaignDefinition, CampaignState } from '../../core/nuzlocke/campaign'
import { campaignEvolutionItems } from '../../core/nuzlocke/calendar'
import { heldItemStock } from '../../core/nuzlocke/heldItems'
import { campaignRules, reached } from '../../core/nuzlocke/rules'
import type { GameData } from '../../core/types'
import { esCampaign } from '../../i18n/esCampaign'
import { machineLabel, type BagItem, type Pocket } from '../campaign/bagModel'

const UNOVA = campaignRules('unova-n2b2')
const held = unovaItems.held as Readonly<Record<string, { kind: string }>>
const machines = unovaCalendar.machines as Readonly<Record<string, { before: string; move: string }>>
const itemTexts = descriptions.items as Readonly<Record<string, string>>
const moveTexts = descriptions.moves as Readonly<Record<string, string>>

const pocketOf = (id: string): Pocket => (held[id]?.kind === 'berry' ? 'berries' : 'items')

export function unovaBagContents(state: CampaignState, pocket: Pocket, memberId: string, definition: CampaignDefinition, data: GameData): BagItem[] {
  const name = (id: string) => data.names.items[id] ?? id
  if (pocket === 'evolution') {
    return [...campaignEvolutionItems(definition, state)].map((id) => ({ id, name: name(id), text: itemTexts[id] ?? '', free: 0, view: true }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
  if (pocket === 'machines') {
    return Object.entries(machines).filter(([, machine]) => reached(UNOVA, state, machine.before)).sort(([a], [b]) => a.localeCompare(b))
      .map(([id, machine]) => ({ id, name: esCampaign.bag.machineName(machineLabel(id), data.names.moves[machine.move] ?? machine.move),
        text: moveTexts[machine.move] ?? '', free: 0, view: true }))
  }
  return Object.entries(heldItemStock(UNOVA, state)).flatMap(([id, count]) => {
    if (pocketOf(id) !== pocket) return []
    const used = state.members.filter((member) => member.id !== memberId && !member.fainted && member.item === id).length
    const free = count - used
    return free > 0 ? [{ id, name: name(id), text: itemTexts[id] ?? '', free }] : []
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
