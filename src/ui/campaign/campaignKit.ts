/**
 * Kit de cada campaña (DEC-103): lo que la pantalla de campaña necesita de una campaña concreta (encuentros, definición, reglas,
 * entrenadores, descripciones de movimientos, semilla). El recorrido (`CampaignView`) es uno solo; cada campaña aporta su kit.
 *
 * Aquí, el tipo y el de Hoenn; el de Teselia vive en `campaign-unova/unovaKit.ts` y se carga aparte, para que su progresión (1,2 MB) no
 * entre en el bloque de la campaña de Hoenn.
 */
import catalog from '../../../data/nuzlocke/hoenn-emerald.json'
import progression from '../../../data/nuzlocke/hoenn-emerald-progression.json'
import moveTexts from '../../../data/nuzlocke/emerald-move-descriptions-es.json'
import type { CampaignDefinition } from '../../core/nuzlocke/campaign'
import { campaignRules, type CampaignId, type CampaignRules } from '../../core/nuzlocke/rules'
import type { ComponentType, CSSProperties } from 'react'
import { emeraldTheme } from '../console/themes/emerald'
import { esCampaign } from '../../i18n/esCampaign'
import { routePlaces, type CampaignEncounter, type RoutePlace } from './hoennRoute'
import { RouteScreen } from './RouteScreen'
import { CampaignCard, TeamPanel, type CampaignCardProps, type TeamPanelProps } from './CampaignSide'
import { itemName as emeraldItemName } from './bagModel'

/** Lo que recibe la pantalla Ruta de cualquier campaña. */
export type RouteScreenProps = {
  places: readonly RoutePlace[]
  badges: number
  speciesName: (id: string) => string
  league?: { rivals: readonly CampaignEncounter[]; next: number }
  /** Si la ficha lleva su tira de medallas (Teselia); en Hoenn van en la barra del portal. */
  showBadges?: boolean
  scale?: number
  reservedHeight?: number
}

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
  /** Lugares del mapa de la Ruta (gimnasios en orden y la Liga con el campeón). */
  places: readonly RoutePlace[]
  /** Nombre de la medalla de cada gimnasio, por id del líder (en mayúsculas). */
  badgeNames: Readonly<Record<string, string>>
  /** Las medallas van en la ficha de la Ruta (Teselia) y no en la barra del portal (Hoenn). */
  medalsInCard: boolean
  /** Nombre de un objeto como lo escribe el juego (Esmeralda, en mayúsculas; N2/B2, como en el diario). */
  itemName: (id: string) => string
  /** Nombre de una especie como lo escribe el juego (Esmeralda, en mayúsculas; N2/B2, tal cual). */
  speciesLabel: (name: string) => string
  /** Pantallas propias de la campaña. */
  screens: { Route: ComponentType<RouteScreenProps>; CampaignCard: ComponentType<CampaignCardProps>; TeamPanel: ComponentType<TeamPanelProps> }
  /** Lienzo de la consola en píxeles del juego (para colocar los paneles laterales). */
  console: { w: number; h: number }
  /** Rótulo del modo en la cabecera. */
  modeLabel: string
  /** Variables CSS de la página (las piezas de los botones, en URL absoluta). */
  pageVars: () => CSSProperties
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
  places: routePlaces(hoennEncounters),
  badgeNames: esCampaign.route.badges,
  medalsInCard: false,
  itemName: emeraldItemName,
  speciesLabel: (name) => name.toUpperCase(),
  screens: { Route: RouteScreen, CampaignCard, TeamPanel },
  console: { w: 240, h: 320 },
  modeLabel: esCampaign.modeLabel,
  // Marco de ventana de Esmeralda para los botones (URL absoluta: relativa en una variable CSS se resolvería contra la hoja de estilos).
  pageVars: () => ({ '--campaign-frame': `url("${new URL(emeraldTheme.asset('marco-1'), document.baseURI).href}")` }) as CSSProperties,
}
