/**
 * Kit de la campaña de Teselia (DEC-106). Módulo aparte del de Hoenn (campaignKit.ts): se importa solo al abrir esta campaña, así que su
 * progresión (1,2 MB) no entra en el bloque de la de Hoenn.
 */
import unovaCatalog from '../../../data/nuzlocke/unova-n2b2.json'
import unovaProgression from '../../../data/nuzlocke/unova-n2b2-progression.json'
import { moveDescription as gen5MoveDescription } from '../battle/party/summaryModel'
import type { CampaignDefinition } from '../../core/nuzlocke/campaign'
import { campaignRules } from '../../core/nuzlocke/rules'
import { esCampaign } from '../../i18n/esCampaign'
import type { CampaignKit } from '../campaign/campaignKit'
import { routePlaces, type CampaignEncounter } from '../campaign/hoennRoute'
import { UnovaRouteScreen } from './UnovaRouteScreen'
import { UnovaCampaignCard, UnovaTeamPanel } from './UnovaSide'
import { UnovaDraftScreen } from './UnovaDraftScreen'
import { UnovaTeamScreen } from './UnovaTeamScreen'
import { UnovaMovesScreen } from './UnovaMovesScreen'
import { UnovaBagScreen } from './UnovaBagScreen'
import { unovaBagContents } from './unovaBag'
import { UnovaExchangeScreen } from './UnovaExchangeScreen'
import descriptions from '../../generated/descriptions-es.json'
import names from '../../generated/names-es.json'
import { UNOVA_PLACES, unovaVars } from './unovaRoute'

const unovaEncounters = unovaCatalog.encounters as readonly CampaignEncounter[]
/** Rivales femeninas de Teselia (Hiedra, Camila, Gerania, Anís, Catleya, Iris). */
const UNOVA_FEMALE = new Set(['hiedra', 'camila', 'gerania', 'anis', 'catleya', 'iris'])

/** Teselia (N2/B2, PRD §0 del 13/11/2026): mismos datos de combate que el diario (Gen 5), con sus descripciones de movimientos. */
const unovaDefinition = { campaign: 'unova-n2b2', encounters: unovaEncounters, species: unovaProgression.species } as unknown as CampaignDefinition

export const unovaKit: CampaignKit = {
  id: 'unova-n2b2',
  encounters: unovaEncounters,
  definition: unovaDefinition,
  rules: campaignRules('unova-n2b2'),
  trainerOf: (encounter) => ({
    nameEs: encounter.nameEs,
    category: encounter.kind === 'champion' ? 'champion' : 'leader',
    gender: UNOVA_FEMALE.has(encounter.id) ? 'F' : 'M',
  }),
  moveDescription: (move) => gen5MoveDescription(move) ?? '',
  seedPrefix: 'teselia',
  places: routePlaces(unovaEncounters, UNOVA_PLACES),
  badgeNames: esCampaign.unova.badges,
  medalsInCard: true,
  itemName: (id) => (names.items as Record<string, string>)[id] ?? id,
  itemText: (id) => (descriptions.items as Record<string, string>)[id] ?? '',
  speciesLabel: (name) => name,
  screens: { Route: UnovaRouteScreen, Draft: UnovaDraftScreen, Team: UnovaTeamScreen, Moves: UnovaMovesScreen, Bag: UnovaBagScreen, Exchange: UnovaExchangeScreen, CampaignCard: UnovaCampaignCard, TeamPanel: UnovaTeamPanel },
  bagContents: (state, pocket, memberId, data) => unovaBagContents(state, pocket, memberId, unovaDefinition, data),
  console: { w: 256, h: 384 },
  modeLabel: esCampaign.unova.modeLabel,
  pageVars: unovaVars,
}
