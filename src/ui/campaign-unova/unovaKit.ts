/**
 * Kit de la campaña de Teselia (DEC-106). Módulo aparte del de Hoenn (campaignKit.ts): se importa solo al abrir esta campaña, así que su
 * progresión (1,2 MB) no entra en el bloque de la de Hoenn.
 */
import { UnovaBattle } from './UnovaBattle'
import { unovaMusic, unovaSounds } from './unovaMusic'
import { moveDescription as gen5MoveDescription } from '../battle/party/summaryModel'
import { campaignRules } from '../../core/nuzlocke/rules'
import { esUnova } from '../../i18n/esUnova'
import type { CampaignKit } from '../campaign/campaignKit'
import { routePlaces } from '../campaign/hoennRoute'
import { unovaDefinition, unovaEncounters } from './unovaDefinition'
import { UnovaRouteScreen } from './UnovaRouteScreen'
import { UnovaCampaignCard, UnovaTeamPanel } from './UnovaSide'
import { UnovaDraftScreen } from './UnovaDraftScreen'
import { UnovaTeamScreen } from './UnovaTeamScreen'
import { UnovaMovesScreen } from './UnovaMovesScreen'
import { UnovaBagScreen } from './UnovaBagScreen'
import { unovaBagContents } from './unovaBag'
import { UnovaExchangeScreen } from './UnovaExchangeScreen'
import { UnovaEvolutionScene } from './UnovaEvolutionScene'
import { UnovaLeagueScreen } from './UnovaLeagueScreen'
import { UnovaResultScreen } from './UnovaResultScreen'
import { UnovaShareScreen } from './UnovaShareScreen'
import descriptions from '../../generated/descriptions-es.json'
import names from '../../generated/names-es.json'
import { UNOVA_PLACES, unovaVars } from './unovaRoute'

/** Rivales femeninas de Teselia (Hiedra, Camila, Gerania, Anís, Catleya, Iris). */
const UNOVA_FEMALE = new Set(['hiedra', 'camila', 'gerania', 'anis', 'catleya', 'iris'])

export const unovaKit: CampaignKit = {
  id: 'unova-n2b2',
  music: unovaMusic,
  sounds: unovaSounds,
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
  badgeNames: esUnova.badges,
  medalsInCard: true,
  itemName: (id) => (names.items as Record<string, string>)[id] ?? id,
  itemText: (id) => (descriptions.items as Record<string, string>)[id] ?? '',
  speciesLabel: (name) => name,
  screens: { Battle: UnovaBattle, Route: UnovaRouteScreen, Draft: UnovaDraftScreen, Team: UnovaTeamScreen, Moves: UnovaMovesScreen, Bag: UnovaBagScreen, Exchange: UnovaExchangeScreen, Evolution: UnovaEvolutionScene, League: UnovaLeagueScreen, Result: UnovaResultScreen, Share: UnovaShareScreen, CampaignCard: UnovaCampaignCard, TeamPanel: UnovaTeamPanel },
  bagContents: (state, pocket, memberId, data) => unovaBagContents(state, pocket, memberId, unovaDefinition, data),
  console: { w: 256, h: 384 },
  modeLabel: esUnova.modeLabel,
  protagonistNames: esUnova.protagonist,
  pageVars: unovaVars,
}
