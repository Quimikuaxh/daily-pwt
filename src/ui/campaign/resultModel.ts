/**
 * Modelo de la pantalla Resultado de la campaña (D7, maqueta aprobada el 11/11/2026): qué se enseña al acabar un combate (medalla tras un
 * gimnasio, «Has vencido a…» tras el Alto Mando, el Salón de la Fama tras el campeón y la derrota si no quedan Pokémon), el nombre del
 * jugador (su nickname o, sin cuenta, BRUNO o AURA según la semilla; Jose, 11/11/2026) y los datos de la Ficha de Entrenador con sus
 * equivalentes de la campaña: Puntos Batalla en DINERO, especies reclutadas en POKéDEX y el tiempo desde el inicio en TIEMPO.
 */
import type { CampaignState } from '../../core/nuzlocke/campaign'
import { esCampaign } from '../../i18n/esCampaign'
import type { CampaignEncounter } from './hoennRoute'

export type ResultMode = 'medal' | 'beaten' | 'whiteout' | 'hallOfFame'
export type Protagonist = 'brendan' | 'may'

/** Resultado del encuentro que acaba de cerrarse (`before` es el estado durante el combate y `after`, el guardado al cerrarlo). */
export function resultOf(before: CampaignState, after: CampaignState, encounters: readonly CampaignEncounter[]): { mode: ResultMode; encounter: CampaignEncounter } {
  const encounter = encounters[before.encounterIndex]
  if (after.phase === 'lost') return { mode: 'whiteout', encounter }
  if (after.phase === 'won' || encounter.kind === 'champion') return { mode: 'hallOfFame', encounter }
  return { mode: encounter.kind === 'gym' ? 'medal' : 'beaten', encounter }
}

/** Lo que guarda la pantalla de campaña al cerrar un combate para enseñar su resultado. */
export type CampaignResult = { mode: ResultMode; encounter: CampaignEncounter; lineup: readonly string[]; after: CampaignState; minutes: number }

const hash = (text: string): number => [...text].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 7)

/** Nº de ID de la ficha: cinco cifras fijas para cada campaña. */
export const trainerId = (seed: string): string => String(hash(seed) % 100000).padStart(5, '0')

/** Protagonista de Esmeralda de la campaña, fijo por semilla. */
export const protagonistOf = (seed: string): Protagonist => (hash(`${seed}:protagonista`) % 2 === 0 ? 'brendan' : 'may')

/** Nombre del jugador: el nickname de la cuenta o, sin él, el del protagonista. */
export const playerNameOf = (seed: string, nickname?: string): string => nickname ?? esCampaign.result.protagonist[protagonistOf(seed)]

/** Minutos desde que empezó la campaña (0 en campañas guardadas antes de registrarlo). */
export const minutesSince = (startedAt: number | undefined, now: number): number => startedAt !== undefined ? Math.max(0, Math.floor((now - startedAt) / 60000)) : 0

/** Especies distintas reclutadas en la campaña (la POKéDEX de la ficha). */
export const recruitedSpecies = (state: CampaignState): number => new Set(state.members.map((member) => member.history[0]?.species ?? member.species)).size

/** Posiciones del Salón de la Fama (hall_of_fame.c, sHallOfFame_MonFullTeamPositions): hasta tres en fila, más en dos filas. */
/**
 * Orden de pintado del Salón de la Fama: de arriba abajo, para que la fila de abajo quede delante y no aparezca pisada (Jose,
 * 12/11/2026). El juego pinta al primero delante de todos; aquí se descarta porque los de abajo quedaban tapados por los de arriba.
 */
export const hallOfFameOrder = (count: number): number[] =>
  hallOfFameSpots(count).slice(0, count).map((spot, i) => [spot[1], i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, i]) => i)

export const hallOfFameSpots = (count: number): [number, number][] =>
  count <= 3 ? [[120, 64], [56, 64], [184, 64]] : [[120, 40], [56, 40], [184, 40], [120, 88], [200, 88], [40, 88]]
