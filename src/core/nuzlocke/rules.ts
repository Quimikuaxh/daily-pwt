/**
 * Reglas de cada campaña (DEC-104): lo que en Hoenn venía de leer `hoenn-emerald-calendar.json` y de preguntar «¿es Esmeralda?»
 * (`isEmeraldCampaign`), en un objeto por campaña. El núcleo decide con `rulesOf(definition)`; una definición sin campaña conocida
 * (las de los tests unitarios) no tiene reglas y conserva el contrato de antes: el llamador da los desbloqueos.
 *
 * Hoenn (Esmeralda) se construye de su calendario aprobado, sin cambiar nada de su comportamiento. Teselia (N2/B2), de
 * `unova-n2b2-calendar.json` y `unova-n2b2-items.json` (aprobados el 13/11/2026) y de las decisiones del PRD §0 de esa fecha.
 */
import hoennCalendar from '../../../data/nuzlocke/hoenn-emerald-calendar.json'
import unovaCalendar from '../../../data/nuzlocke/unova-n2b2-calendar.json'
import unovaItems from '../../../data/nuzlocke/unova-n2b2-items.json'

export type CampaignId = 'hoenn-emerald' | 'unova-n2b2'
export const CAMPAIGN_IDS: readonly CampaignId[] = ['hoenn-emerald', 'unova-n2b2']

export type HeldEntry =
  | { kind: 'held'; units: readonly { before: string }[]; infinite?: false }
  | { kind: 'held' | 'berry'; before: string; infinite: true }

export type CampaignRules = {
  id: CampaignId
  /** Generación del combate y de los datos. */
  generation: 3 | 5
  /** Versión de las reglas: entra en la semilla del combate, así que cambiarla cambia los combates nuevos. */
  rulesVersion: string
  /** Rivales en orden; el tramo n es lo que hay antes del rival n. */
  milestones: readonly string[]
  /** Ataque de MT/MO → hito desde el que se puede enseñar. */
  machines: Readonly<Record<string, string>>
  /** Objeto de evolución → hito desde el que se tiene una unidad; `choice`, los premios alternativos (el Escáner de Hoenn). */
  evolutionItems: Readonly<Record<string, { before: string; choice?: string }>>
  held: Readonly<Record<string, HeldEntry>>
  exchange: readonly { item: string; price: number }[]
  battlePoints: { perGym: number; flawlessBonus: number }
  friendshipWins: number
  leagueFriendship: boolean
  battleHappiness: number
  /** Hito desde el que vale la belleza (Feebas en Hoenn); `null` si no hay. */
  beautyBefore: string | null
  /** Nivel de las evoluciones por intercambio (y de las que la campaña asimila a ellas). */
  tradeLevel: number
  /** Lugar de evolución → hito desde el que se llega; `null`, solo con la evolución de la Liga. */
  locations: Readonly<Record<string, string | null>>
  /** Los reclutas tienen sexo (sorteado al reclutarlos) y las evoluciones de un solo sexo lo exigen. */
  genders: boolean
  /** Tipo de cada gimnasio, para la garantía de cobertura del draft (PRD §0); la Liga no tiene. */
  gymTypes: Readonly<Record<string, string>>
}

const TRADE_LEVEL = 37

function hoennRules(): CampaignRules {
  const items = hoennCalendar.items as Readonly<Record<string, { before: string; move?: string; choice?: string }>>
  return {
    id: 'hoenn-emerald',
    generation: 3,
    rulesVersion: hoennCalendar.rulesVersion,
    milestones: hoennCalendar.milestones,
    machines: Object.fromEntries(Object.values(items).flatMap((item) => item.move ? [[item.move, item.before]] : [])),
    evolutionItems: Object.fromEntries(Object.entries(items).flatMap(([id, item]) => item.move ? [] : [[id, { before: item.before, ...(item.choice ? { choice: item.choice } : {}) }]])),
    held: hoennCalendar.held as unknown as CampaignRules['held'],
    exchange: hoennCalendar.exchange.map(({ item, price }) => ({ item, price })),
    battlePoints: { perGym: 20, flawlessBonus: 8 },
    friendshipWins: hoennCalendar.friendshipWins,
    leagueFriendship: hoennCalendar.leagueFriendship,
    battleHappiness: hoennCalendar.battleHappiness,
    beautyBefore: hoennCalendar.beautyBefore,
    tradeLevel: TRADE_LEVEL,
    locations: {},
    // Sexo por sorteo al reclutar, como en Teselia (Jose, 17/11/2026: la caja de PS de Esmeralda lo enseña). En Gen 3 no hay evoluciones
    // de un solo sexo, así que no cambia ninguna.
    genders: true,
    gymTypes: { petra: 'Rock', marcial: 'Fighting', erico: 'Electric', candela: 'Fire', norman: 'Normal', alana: 'Flying', 'vito-y-leti': 'Psychic', galano: 'Water' },
  }
}

function unovaRules(): CampaignRules {
  const machines = unovaCalendar.machines as Readonly<Record<string, { before: string; move: string }>>
  const evolution = unovaItems.evolution as Readonly<Record<string, { before: string }>>
  return {
    id: 'unova-n2b2',
    generation: 5,
    rulesVersion: `${unovaCalendar.rulesVersion}|${unovaItems.rulesVersion}`,
    milestones: unovaCalendar.milestones,
    machines: Object.fromEntries(Object.values(machines).map((entry) => [entry.move, entry.before])),
    evolutionItems: Object.fromEntries(Object.entries(evolution).map(([id, entry]) => [id, { before: entry.before }])),
    held: unovaItems.held as unknown as CampaignRules['held'],
    exchange: unovaItems.exchange,
    battlePoints: unovaItems.exchangePoints,
    // Las de Hoenn (PRD §0, «mismas reglas»): tres victorias para la amistad, la plantilla de la Liga cuenta y combate con 255.
    friendshipWins: hoennCalendar.friendshipWins,
    leagueFriendship: hoennCalendar.leagueFriendship,
    battleHappiness: hoennCalendar.battleHappiness,
    beautyBefore: null,
    tradeLevel: TRADE_LEVEL,
    // Campo magnético de la Cueva Electrorroca (tramo de Gerania); las rocas Musgo y Hielo, solo en la Liga (PRD §0, 13/11/2026).
    locations: { magnetic: 'gerania', moss: null, ice: null },
    genders: true,
    gymTypes: { cheren: 'Normal', hiedra: 'Poison', camus: 'Bug', camila: 'Electric', yakon: 'Ground', gerania: 'Flying', lirio: 'Dragon', ciprian: 'Water' },
  }
}

const RULES: Readonly<Record<CampaignId, CampaignRules>> = { 'hoenn-emerald': hoennRules(), 'unova-n2b2': unovaRules() }

export const campaignRules = (id: CampaignId): CampaignRules => RULES[id]

/**
 * Reglas de una definición: las de su `campaign` o, sin ella, las de Hoenn si sus encuentros son los de Esmeralda (las definiciones de
 * antes de DEC-104); si no, `null`.
 */
export function rulesOf(definition: { campaign?: CampaignId; encounters: readonly { id: string }[] }): CampaignRules | null {
  if (definition.campaign) return RULES[definition.campaign]
  const hoenn = RULES['hoenn-emerald']
  return definition.encounters.length === hoenn.milestones.length && definition.encounters.every((encounter, index) => encounter.id === hoenn.milestones[index])
    ? hoenn : null
}

/** Si el estado ya ha llegado al tramo de `before` (el hito existe en la campaña). */
export function reached(rules: CampaignRules, state: { encounterIndex: number }, before: string): boolean {
  const index = rules.milestones.indexOf(before)
  return index >= 0 && state.encounterIndex >= index
}
