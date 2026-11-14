/**
 * Kit de cada campaña (DEC-106): lo que la pantalla de campaña necesita de una campaña concreta (encuentros, definición, reglas,
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
import { DraftScreen } from './DraftScreen'
import { TeamScreen, type TeamScreenProps as HoennTeamProps } from './TeamScreen'
import { MovesScreen, type MovesScreenProps as HoennMovesProps } from './MovesScreen'
import { BagScreen, type BagScreenProps as HoennBagProps } from './BagScreen'
import { ExchangeScreen, type ExchangeScreenProps as HoennExchangeProps } from './ExchangeScreen'
import { EvolutionScene, type EvolutionSceneProps as HoennEvolutionProps } from './EvolutionScene'
import { LeagueScreen, type LeagueScreenProps } from './LeagueScreen'
import { bagContents, itemText as emeraldItemText, machineItems, machineLabel, type BagItem, type Pocket } from './bagModel'
import { emeraldMoveName } from './emeraldNames'
import { campaignEvolutionItems } from '../../core/nuzlocke/calendar'
import type { CampaignState } from '../../core/nuzlocke/campaign'
import type { PartyMember } from '../battle/party/partyModel'
import type { Candidate } from './draftModel'
import type { GameData } from '../../core/types'

/** Lo que recibe el draft de cualquier campaña (Hoenn no usa `data` ni `definition`). */
export type DraftScreenProps = {
  candidates: readonly Candidate[]
  /** Elección actual (0…) y cuántas hay en este hito. */
  pick: number
  picks: number
  level: number
  rivalName: string
  onRecruit: (id: string) => void
  onShowTeam?: () => void
  data: GameData
  definition: CampaignDefinition
  scale?: number
  reservedHeight?: number
}

/** Lo que recibe Equipo y PC de cualquier campaña: Hoenn usa `summaryOf` (su ficha); Teselia, `details` y `data` (la del diario). */
export type TeamScreenProps = HoennTeamProps & { details?: (id: string) => PartyMember | null; data: GameData }

/** Lo que recibe Movimientos de cualquier campaña: Teselia usa además `member` y `data` (la pantalla de datos del diario). */
export type MovesScreenProps = HoennMovesProps & { member: PartyMember | null; data: GameData }

/** Lo que recibe la Mochila de cualquier campaña: Teselia usa además `itemName` (para preguntar si cambiar el que lleva). */
export type BagScreenProps = HoennBagProps & { itemName: (id: string) => string }

/** Lo que recibe la Tienda de cualquier campaña: Teselia usa además nombres, descripciones, lo que ya tienes y el equipo. */
export type ExchangeScreenProps = HoennExchangeProps & {
  itemName: (id: string) => string
  itemText: (id: string) => string
  owned: (id: string) => number
  team: readonly { species: string; name: string; item: string | null }[]
}

/** Lo que recibe la escena de evolución de cualquier campaña: Teselia usa además `data` (sus sprites de 5.ª generación). */
export type EvolutionSceneProps = HoennEvolutionProps & { data: GameData }

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
  /** Descripción de un objeto (la de la época de la campaña). */
  itemText: (id: string) => string
  /** Nombre de una especie como lo escribe el juego (Esmeralda, en mayúsculas; N2/B2, tal cual). */
  speciesLabel: (name: string) => string
  /** Pantallas propias de la campaña. */
  screens: {
    Route: ComponentType<RouteScreenProps>
    Draft: ComponentType<DraftScreenProps>
    Team: ComponentType<TeamScreenProps>
    Moves: ComponentType<MovesScreenProps>
    Bag: ComponentType<BagScreenProps>
    Exchange: ComponentType<ExchangeScreenProps>
    Evolution: ComponentType<EvolutionSceneProps>
    League: ComponentType<LeagueScreenProps>
    CampaignCard: ComponentType<CampaignCardProps>
    TeamPanel: ComponentType<TeamPanelProps>
  }
  /** Lo que hay en un bolsillo de la Mochila para el miembro `memberId` (las unidades que no lleva otro). */
  bagContents: (state: CampaignState, pocket: Pocket, memberId: string, data: GameData) => BagItem[]
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

const hoennDefinition = { encounters: hoennEncounters, species: progression.species } as unknown as CampaignDefinition
const hoennMoveDescription = (move: string) => (moveTexts as unknown as { moves: Record<string, string> }).moves[move] ?? ''

export const hoennKit: CampaignKit = {
  id: 'hoenn-emerald',
  encounters: hoennEncounters,
  definition: hoennDefinition,
  rules: campaignRules('hoenn-emerald'),
  trainerOf: (encounter) => ({
    nameEs: encounter.nameEs,
    category: encounter.kind === 'champion' ? 'champion' : 'leader',
    gender: HOENN_FEMALE.has(encounter.id) ? 'F' : 'M',
  }),
  moveDescription: hoennMoveDescription,
  seedPrefix: 'hoenn',
  places: routePlaces(hoennEncounters),
  badgeNames: esCampaign.route.badges,
  medalsInCard: false,
  itemName: emeraldItemName,
  itemText: emeraldItemText,
  speciesLabel: (name) => name.toUpperCase(),
  screens: { Route: RouteScreen, Draft: DraftScreen, Team: TeamScreen, Moves: MovesScreen, Bag: BagScreen, Exchange: ExchangeScreen, Evolution: EvolutionScene, League: LeagueScreen, CampaignCard, TeamPanel },
  // OBJ. EVOL. y MT/MO, solo para mirar, con los nombres y descripciones de Esmeralda.
  bagContents: (state, pocket, memberId, data) => {
    if (pocket === 'evolution') {
      return [...campaignEvolutionItems(hoennDefinition, state)].sort().map((id) => ({ id, name: emeraldItemName(id), text: esCampaign.bag.evolutionText, free: 0, view: true }))
    }
    if (pocket === 'machines') {
      return machineItems(state).map(({ id, move }) => ({ id, name: esCampaign.bag.machineName(machineLabel(id), emeraldMoveName(move, data.names)),
        text: hoennMoveDescription(move), free: 0, view: true }))
    }
    return bagContents(state, pocket, memberId)
  },
  console: { w: 240, h: 320 },
  modeLabel: esCampaign.modeLabel,
  // Marco de ventana de Esmeralda para los botones (URL absoluta: relativa en una variable CSS se resolvería contra la hoja de estilos).
  pageVars: () => ({ '--campaign-frame': `url("${new URL(emeraldTheme.asset('marco-1'), document.baseURI).href}")` }) as CSSProperties,
}
