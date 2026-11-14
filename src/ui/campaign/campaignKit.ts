/**
 * Kit de cada campaña (DEC-103): lo que la pantalla de campaña necesita de una campaña concreta (encuentros, definición, reglas,
 * entrenadores, descripciones de movimientos, semilla). El recorrido (`CampaignView`) es uno solo; cada campaña aporta su kit.
 */
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import moveTexts from '../../../data/nuzlocke/emerald-move-descriptions-es.json'
import unovaCatalog from '../../../data/nuzlocke/unova-n2b2.json'
import unovaProgression from '../../../data/nuzlocke/unova-n2b2-progression.json'
import { moveDescription as gen5MoveDescription } from '../battle/party/summaryModel'
import type { CampaignDefinition } from '../../core/nuzlocke/campaign'
import { campaignRules, type CampaignId, type CampaignRules } from '../../core/nuzlocke/rules'
import type { CampaignEncounter } from './hoennRoute'

export type CampaignKit = {
  id: CampaignId
  encounters: readonly CampaignEncounter[]
  definition: CampaignDefinition
  rules: CampaignRules
  /** Datos del rival para los textos del combate («la LÍDER» / «el LÍDER») y su música. */
  trainerOf: (encounter: CampaignEncounter) => { nameEs: string; category: 'leader' | 'champion'; gender: 'F' | 'M' }
  /** Descripción española de un movimiento en dos líneas (la de Movimientos). */
  moveDescription: (move: string) => string
  /** Prefijo de la semilla de una partida nueva. */
  seedPrefix: string
}

const hoennEncounters = catalog.encounters as readonly CampaignEncounter[]
/** Género del rival para «la LÍDER» / «el LÍDER» (Esmeralda); el Alto Mando habla como líder y Plubio como campeón. */
const HOENN_FEMALE = new Set(['petra', 'candela', 'alana', 'fatima', 'nivea'])

export const hoennKit: CampaignKit = {
  id: 'hoenn-emerald',
  encounters: hoennEncounters,
  definition: { encounters: hoennEncounters, species: progression.species } as unknown as CampaignDefinition,
  rules: campaignRules('hoenn-emerald'),
  trainerOf: (encounter) => ({
    nameEs: encounter.nameEs,
    category: encounter.kind === 'champion' ? 'champion' : 'leader',
    gender: HOENN_FEMALE.has(encounter.id) ? 'F' : 'M',
  }),
  moveDescription: (move) => (moveTexts as unknown as { moves: Record<string, string> }).moves[move] ?? '',
  seedPrefix: 'hoenn',
}

const unovaEncounters = unovaCatalog.encounters as readonly CampaignEncounter[]
/** Rivales femeninas de Teselia (Hiedra, Camila, Gerania, Anís, Catleya, Iris). */
const UNOVA_FEMALE = new Set(['hiedra', 'camila', 'gerania', 'anis', 'catleya', 'iris'])

/** Teselia (N2/B2, PRD §0 del 13/11/2026): mismos datos de combate que el diario (Gen 5), con sus descripciones de movimientos. */
export const unovaKit: CampaignKit = {
  id: 'unova-n2b2',
  encounters: unovaEncounters,
  definition: { campaign: 'unova-n2b2', encounters: unovaEncounters, species: unovaProgression.species } as unknown as CampaignDefinition,
  rules: campaignRules('unova-n2b2'),
  trainerOf: (encounter) => ({
    nameEs: encounter.nameEs,
    category: encounter.kind === 'champion' ? 'champion' : 'leader',
    gender: UNOVA_FEMALE.has(encounter.id) ? 'F' : 'M',
  }),
  moveDescription: (move) => gen5MoveDescription(move) ?? '',
  seedPrefix: 'teselia',
}
